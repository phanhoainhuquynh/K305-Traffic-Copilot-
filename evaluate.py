"""Offline baseline check; never used to supply runtime predictions with future data."""
from bisect import bisect_left
import json
import math
from pathlib import Path
from statistics import mean, median
from server import TrafficData, DEFAULT_DATA


def evaluate(data, stride=10):
    epochs=[f['epoch'] for f in data.frames]
    lookups=[{o['id']:o for o in f['objects']} for f in data.frames]
    results={}
    for h in (3,5):
        errors=[];eligible=0
        for i in range(0,len(data.frames),stride):
            j=bisect_left(epochs,epochs[i]+h-.025)
            if j>=len(epochs) or abs(epochs[j]-epochs[i]-h)>.15: continue
            dt=epochs[j]-epochs[i]
            for o in data.frames[i]['objects']:
                eligible+=1
                future=lookups[j].get(o['id'])
                if future is None: continue
                # Require continuous presence across this interval; tracking identity still comes from source.
                if any(o['id'] not in lookups[k] for k in range(i,j+1)): continue
                errors.append(math.hypot(o['x']+o['vx']*dt-future['x'],o['y']+o['vy']*dt-future['y']))
        ordered=sorted(errors)
        results[str(h)]={'horizon_seconds':h,'eligible_start_observations':eligible,'continuous_track_pairs':len(errors),
                         'mean_endpoint_error_m':round(mean(errors),3) if errors else None,
                         'median_endpoint_error_m':round(median(errors),3) if errors else None,
                         'p90_endpoint_error_m':round(ordered[min(len(ordered)-1,math.ceil(.9*len(ordered))-1)],3) if errors else None}
    return {'source':data.path.name,'method':'Constant velocity, sampled every 10 frames; future observations used for offline evaluation only.',
            'limitations':'Units assumed m and m/s. Measured against tracker output, not independent ground truth. Continuous visible tracks only; survivorship bias. No calibrated confidence or collision validation.',
            'results':results}


if __name__=='__main__':
    result=evaluate(TrafficData(DEFAULT_DATA))
    target=Path(__file__).with_name('evaluation.json')
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
