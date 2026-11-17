import copy
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch

from server import TrafficData, Handler, ThreadingHTTPServer, inside, lane_check, prediction, proximity, validate_lanes
from localization import CATALOG, translate


def obj(tid=100,x=0,y=0,vx=2,vy=0,label='Car'):
    return {'track_id':tid,'class_name':label,'score':1,'bounding_box':{'position':{'x':x,'y':y},'yaw':0,'scale':{'x':4,'y':2}},'velocity':{'x':vx,'y':vy}}


class TrafficTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        frames=[{'timestamp_local':f'2026-06-16T07:00:0{i}+02:00','objects':objects} for i,objects in enumerate([
            [obj(),obj(200,10,0,-2)], [obj(x=2),obj(200,8,0,-2)], [obj(200,6,0,-2),obj(300,label='Pedestrian')]])]
        (self.root/'data.json').write_text(json.dumps({'frames':frames}),encoding='utf-8')
        self.data=TrafficData(self.root/'data.json',self.root/'lanes.json')
        self.lane={'verified':True,'lanes':[{'id':'East','polygon':[[-5,-5],[5,-5],[5,5],[-5,5]],'heading':0,'allowed':['Car']}]}

    def tearDown(self): self.temp.cleanup()

    def test_no_future_observations(self):
        self.assertFalse(self.data.track(300,0)['available'])
        self.assertEqual(self.data.track(100,0)['observations'],1)
        self.assertEqual(len(self.data.frame(0)['objects'][0]['history']),1)

    def test_stale_object_not_predicted(self):
        answer=self.data.chat('ID 100 đi đâu trong 5 giây?',2,None,5)['answer']
        self.assertIn('Không dự đoán từ quan sát cũ',answer)
        self.assertNotIn('vị trí dự kiến',answer)

    def test_horizon_not_id(self):
        result=self.data.chat('ID 100 đi đâu trong 3 giây?',0,None,5)
        self.assertEqual(result['ids'],[100]);self.assertEqual(result['horizon'],3)
        self.assertIn('(6.00, 0.00)',result['answer'])

    def test_selected_context(self):
        self.assertEqual(self.data.chat('Xe này đi đâu trong 5 giây?',0,100,5)['ids'],[100])

    def test_english_and_german_predictions(self):
        for language,prompt,expected in [('en','Where will ID 100 be in 3 seconds?','predicted position after 3 seconds'),('de','Wo ist ID 100 in 3 Sekunden?','prognostizierte Position nach 3 Sekunden')]:
            result=self.data.chat(prompt,0,None,5,language=language)
            self.assertEqual(result['ids'],[100]);self.assertEqual(result['horizon'],3)
            self.assertIn(expected,result['answer']);self.assertNotIn('Giả định',result['answer'])
            self.assertEqual(result['language'],language)

    def test_german_duration_not_confused_with_lane(self):
        result=self.data.chat('Wie lange wurde ID 100 beobachtet?',1,None,5,language='de')
        self.assertIn('Beobachtet von',result['answer']);self.assertNotIn('Fahrspurkarte',result['answer'])

    def test_german_lane_and_risk(self):
        result=self.data.chat('Fährt ID 100 auf der richtigen Fahrspur?',0,None,5,language='de')
        self.assertIn('Unzureichende Daten',result['answer'])
        result=self.data.chat('Besteht Kollisionsgefahr zwischen ID 100 und 200 in 5 Sekunden?',0,None,5,language='de')
        self.assertIn('kleinster Mittelpunktabstand',result['answer'])
        self.assertIn('bestätigt keine Kollision',result['answer'])
        self.assertNotIn('khoảng cách',result['answer'])

    def test_german_horizon_range_and_missing_id(self):
        result=self.data.chat('Wo ist ID 100 in 3 bis 5 Sekunden?',0,None,3,language='de')
        self.assertEqual(result['ids'],[100]);self.assertEqual(result['horizon'],5)
        self.assertIn('noch nicht beobachtet',self.data.chat('Was ist ID 999?',0,None,5,language='de')['answer'])

    def test_translations_preserve_named_lanes_and_values(self):
        text='Có dấu hiệu ngược chiều làn Làn thử nghiệm (lệch 180°).'
        self.assertIn('Làn thử nghiệm',translate(text,'de'))
        self.assertIn('180°',translate(text,'en'))
        self.assertEqual(translate(text,'vi'),text)
        self.assertEqual(self.data.chat('ID 100',0,None,5,language='xx')['language'],'vi')

    def test_translation_catalog_placeholders(self):
        import re
        sources=set()
        for row in CATALOG:
            self.assertEqual(len(row),3);self.assertNotIn(row[0],sources);sources.add(row[0])
            keys=set(re.findall(r'\{(\w+)\}',row[0]))
            for value in row[1:]:
                self.assertTrue(value.strip());self.assertEqual(keys,set(re.findall(r'\{(\w+)\}',value)))

    def test_german_api_fallback(self):
        self.data.meta['ai_available']=True
        with patch('server.llm_answer',side_effect=TimeoutError) as llm:
            result=self.data.chat('Was ist ID 100?',0,None,5,True,'de')
        self.assertIn('KI-Verbindung ist fehlgeschlagen',result['answer'])
        self.assertEqual(llm.call_args.args[2],'de')

    def test_horizon_range_and_unsupported_horizon(self):
        result=self.data.chat('ID 100 đi đâu trong 3 đến 5 giây?',0,None,3)
        self.assertEqual(result['ids'],[100]);self.assertEqual(result['horizon'],5)
        with self.assertRaises(ValueError): self.data.chat('ID 100 đi đâu trong 10 giây?',0,None,5)

    def test_unknown_id(self):
        self.assertIn('chưa được quan sát',self.data.chat('ID 999 là gì?',0,None,5)['answer'])

    def test_pair_question(self):
        result=self.data.chat('ID 100 và 200 có nguy cơ va chạm trong 5 giây?',0,None,5)
        self.assertEqual(result['ids'],[100,200]);self.assertIn('2.5 s',result['answer'])

    def test_constant_velocity(self):
        o=self.data.frame(0)['objects'][0]
        p=prediction(o,5)[-1]
        self.assertEqual((p['x'],p['y']),(10,0))

    def test_closest_approach(self):
        a,b=self.data.frame(0)['objects']
        p=proximity(a,b,5)
        self.assertEqual(p['t'],2.5);self.assertEqual(p['distance'],0);self.assertTrue(p['flag'])
        p=proximity(dict(a,vx=-2),dict(b,vx=2),5)
        self.assertEqual(p['t'],0);self.assertFalse(p['flag'])

    def test_same_velocity(self):
        a,b=self.data.frame(0)['objects']
        p=proximity(a,dict(b,vx=2),5)
        self.assertEqual(p['t'],0);self.assertEqual(p['distance'],10)

    def test_lane_unknown_until_verified(self):
        o=self.data.frame(0)['objects'][0]
        self.assertEqual(lane_check(o,dict(self.lane,verified=False))['status'],'unknown')
        self.assertEqual(lane_check(o,self.lane)['status'],'aligned')

    def test_wrong_way_stationary_and_wrong_class(self):
        o=self.data.frame(0)['objects'][0]
        self.assertEqual(lane_check(dict(o,vx=-2),self.lane)['status'],'warning')
        self.assertEqual(lane_check(dict(o,vx=0,speed=0),self.lane)['status'],'stationary')
        self.assertEqual(lane_check(dict(o,class_name='Pedestrian'),self.lane)['status'],'warning')

    def test_outside_and_overlapping_lanes_not_violation(self):
        o=self.data.frame(0)['objects'][0]
        self.assertEqual(lane_check(dict(o,x=100),self.lane)['status'],'unknown')
        config=copy.deepcopy(self.lane);config['lanes'].append(dict(config['lanes'][0],id='Other'))
        self.assertEqual(lane_check(o,config)['status'],'unknown')

    def test_polygon_boundary(self):
        poly=self.lane['lanes'][0]['polygon']
        self.assertTrue(inside(5,0,poly));self.assertFalse(inside(5.01,0,poly))

    def test_invalid_geometry_rejected(self):
        for polygon in ([[0,0],[1,1],[2,2]],[[0,0],[4,4],[0,4],[4,0]],[[0,0],[float('nan'),2],[4,0]]):
            config=copy.deepcopy(self.lane);config['lanes'][0]['polygon']=polygon
            with self.assertRaises(ValueError): validate_lanes(config)

    def test_lane_persistence(self):
        self.data.save_lanes(self.lane)
        reread=TrafficData(self.root/'data.json',self.root/'lanes.json')
        self.assertEqual(reread.frame(0)['objects'][0]['lane']['status'],'aligned')

    def test_api_failure_falls_back(self):
        self.data.meta['ai_available']=True
        with patch('server.llm_answer',side_effect=TimeoutError):
            result=self.data.chat('ID 100 là gì?',0,None,5,True)
        self.assertEqual(result['mode'],'local-fallback');self.assertIn('ô tô',result['answer'])

    def test_http_validation_and_origin(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);server.data=self.data
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        base=f'http://127.0.0.1:{server.server_port}'
        try:
            with urlopen(base+'/api/frame?index=0&horizon=3') as r: self.assertEqual(json.load(r)['horizon'],3)
            for path in ('/api/frame?index=-1','/api/frame?horizon=nan','/api/frame?index=999'):
                with self.assertRaises(HTTPError) as err: urlopen(base+path)
                self.assertEqual(err.exception.code,400)
            req=Request(base+'/api/chat',data=b'{"prompt":"overview"}',headers={'Content-Type':'application/json','Origin':'https://other.example'})
            with self.assertRaises(HTTPError) as err: urlopen(req)
            self.assertEqual(err.exception.code,403)
        finally: server.shutdown();server.server_close();thread.join()


if __name__=='__main__': unittest.main()
