"""Shared, deterministic VI/EN/DE message formatting; never translates user data."""
import json
from pathlib import Path
import re

CATALOG = json.loads((Path(__file__).parent/'static'/'locales.json').read_text(encoding='utf-8'))
EXACT = {row[0]:row for row in CATALOG}
PATTERNS = []
for row in CATALOG:
    if '{' not in row[0]:
        continue
    keys=[]; pieces=[]; start=0
    for match in re.finditer(r'\{(\w+)\}',row[0]):
        pieces.append(re.escape(row[0][start:match.start()]))
        pieces.append('(.+?)');keys.append(match[1]);start=match.end()
    pieces.append(re.escape(row[0][start:]))
    PATTERNS.append((re.compile('^'+''.join(pieces)+'$'),keys,row))


def valid_language(language):
    return language if language in ('vi','en','de') else 'vi'


def translate(text,language='vi',depth=0):
    language=valid_language(language)
    if language=='vi' or depth>3:
        return text
    column=1 if language=='en' else 2
    source=text.strip()
    if source in EXACT:
        rendered=EXACT[source][column]
    else:
        rendered=None
        for pattern,keys,row in PATTERNS:
            match=pattern.fullmatch(source)
            if not match: continue
            values=dict(zip(keys,match.groups()))
            rendered=re.sub(r'\{(\w+)\}',lambda m:translate(values[m[1]],language,depth+1) if m[1] in ('label','type','mode') else values[m[1]],row[column])
            break
        if rendered is None:
            if '\n' in source:
                return '\n'.join(translate(line,language,depth+1) for line in text.split('\n'))
            # Compound risk paragraphs join three separately translated sentences.
            sentences=re.split(r'(?<=\.) (?=[A-ZÀ-Ỹ])',source)
            if len(sentences)>1:
                return ' '.join(translate(s,language,depth+1) for s in sentences)
            return text
    return text[:len(text)-len(text.lstrip())]+rendered+text[len(text.rstrip()):]
