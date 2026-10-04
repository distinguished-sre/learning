#!/usr/bin/env python3
"""Проверка единой базы вопросов _data/questions/ (только stdlib).

quiz/NN-MM.json: тестовые вопросы урока (блок «Проверь себя» и страница подготовки).
open/NN-MM.json: устные вопросы с собеседований (раздел урока и страница подготовки).

Запуск: python3 tools/check_questions.py [--stats] [--only 05-03,05-04] [--site _site]. Код выхода 1, если есть ошибки.
--site дополнительно проверяет собранный сайт: банк в странице урока, якоря разделов, JSON тем, ссылки ответов.
--only проверяет только перечисленные уроки (для авторов банков); CI запускает без него.
Структура не подтверждает правильность ответов: содержание проверяется ревью.
"""
import difflib
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QDIR = os.path.join(ROOT, '_data', 'questions')
KINDS = {'понимание', 'применение', 'чтение', 'диагностика'}
TAGS = {'junior', 'middle', 'часто', 'на скорость'}
BANNED = re.compile(r'вс[её] (?:из )?перечисленн|ничего из перечисленн|все (?:варианты|ответы) (?:верн|правильн)'
                    r'|нет (?:верного|правильного) (?:ответа|варианта)', re.I)
NEAR = 0.9

errors, warnings = [], []


def err(where, msg):
    errors.append(f'{where}: {msg}')


def warn(where, msg):
    warnings.append(f'{where}: {msg}')


def lesson_key(lesson_id):
    t, l = lesson_id.split('.')
    return f'{int(t):02d}-{int(l):02d}'


def load_course():
    """Порядок курса из _data/course.yml без PyYAML: нужны только n, dir, id, slug."""
    lessons, topic = [], None
    with open(os.path.join(ROOT, '_data', 'course.yml'), encoding='utf-8') as f:
        cur = {}
        for line in f:
            m = re.match(r'  - n: (\d+)\s*$', line)
            if m:
                topic = {'n': int(m.group(1))}
                continue
            m = re.match(r'    dir: (\S+)\s*$', line)
            if m and topic is not None:
                topic['dir'] = m.group(1)
                continue
            m = re.match(r'      - id: "([\d.]+)"', line)
            if m:
                cur = {'id': m.group(1), 'topic': topic['n'], 'dir': topic['dir']}
                lessons.append(cur)
                continue
            m = re.match(r'        slug: (\S+)\s*$', line)
            if m and cur:
                cur['slug'] = m.group(1)
    return lessons


def gfm_id(text):
    """Как kramdown-parser-gfm строит id заголовка (повторяет assets/js/quiz-core.js slug)."""
    t = text.lower()
    t = ''.join(c for c in t if c in '- \t' or unicodedata.category(c)[0] in 'LM' or unicodedata.category(c) in ('Nd', 'Pc'))
    return t.replace(' ', '-').replace('\t', '-')


def headings(md_path):
    """Заголовки ##/### вне блоков кода: текст → id; повторы id помечены."""
    out, counts, fence = {}, {}, None
    with open(md_path, encoding='utf-8') as f:
        for line in f:
            m = re.match(r'^ {0,3}(`{3,}|~{3,})', line)
            if m:
                if fence is None:
                    fence = m.group(1)
                elif m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence) and not line.strip()[len(m.group(1)):]:
                    fence = None
                continue
            if fence:
                continue
            m = re.match(r'^#{1,6} +(.*?)\s*#*\s*$', line)
            if not m:
                continue
            text = m.group(1)
            base = gfm_id(text)
            counts[base] = counts.get(base, -1) + 1
            out.setdefault(text, []).append(base if counts[base] == 0 else f'{base}-{counts[base]}')
    return out, counts


def norm(s):
    s = s.lower().replace('ё', 'е')
    s = re.sub(r'[`«»"\'.,:;!?()\[\]{}\s]+', ' ', s)
    return s.strip()


def nonempty(v):
    return isinstance(v, str) and v.strip() != ''


def check_text(where, field, s):
    if '—' in s:
        err(where, f'{field}: длинное тире «—», в курсе вместо него двоеточие, запятая или « - »')
    if BANNED.search(s):
        err(where, f'{field}: запрещённая формулировка «{BANNED.search(s).group(0)}»')
    if '{% raw' in s or '{% endraw' in s:
        err(where, f'{field}: теги raw в данных не нужны, Liquid данные не обрабатывает')


def check_quiz(lesson, path, heads, head_counts, seen_ids, all_texts):
    where = os.path.relpath(path, ROOT)
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    except (OSError, ValueError) as e:
        err(where, f'не читается: {e}')
        return None
    if data.get('lesson') != lesson['id']:
        err(where, f'lesson {data.get("lesson")!r}, ожидался {lesson["id"]!r}')
    if data.get('topic') != lesson['topic']:
        err(where, f'topic {data.get("topic")!r}, ожидался {lesson["topic"]}')
    qs = data.get('questions')
    if not isinstance(qs, list):
        err(where, 'нет списка questions')
        return None
    block = data.get('block')
    if not isinstance(block, int) or not 5 <= block <= 10:
        err(where, f'block {block!r}: допустимо целое 5..10')
    elif len(qs) % block:
        err(where, f'{len(qs)} вопросов не делится на блок {block}')
    if not 25 <= len(qs) <= 50:
        err(where, f'{len(qs)} вопросов, нужно 25..50')
    key = lesson_key(lesson['id'])
    kinds, multi, longest, singles, texts = set(), 0, 0, 0, []
    for i, q in enumerate(qs):
        qw = f'{where}#{q.get("id", i)}'
        if not isinstance(q, dict):
            err(qw, 'вопрос не объект')
            continue
        qid = q.get('id')
        if not isinstance(qid, str) or not re.fullmatch(rf'q{key}-\d{{2,3}}', qid):
            err(qw, f'id {qid!r}: формат q{key}-NN')
        elif qid in seen_ids:
            err(qw, f'id повторяется ({seen_ids[qid]})')
        else:
            seen_ids[qid] = where
        for fld in ('skill', 'text', 'explain', 'section'):
            if not nonempty(q.get(fld)):
                err(qw, f'пустое поле {fld}')
        if q.get('kind') not in KINDS:
            err(qw, f'kind {q.get("kind")!r}: один из {sorted(KINDS)}')
        else:
            kinds.add(q['kind'])
        if 'code' in q and not nonempty(q['code']):
            err(qw, 'code пустой: убери поле или заполни')
        opts = q.get('options')
        if not isinstance(opts, list) or not 4 <= len(opts) <= 6:
            err(qw, 'нужно 4..6 вариантов')
            continue
        oids, otexts = [], []
        for o in opts:
            if not isinstance(o, dict) or not re.fullmatch(r'[a-f]', str(o.get('id', ''))):
                err(qw, f'вариант без id a..f: {o!r}'[:200])
                continue
            oids.append(o['id'])
            if not nonempty(o.get('text')):
                err(qw, f'вариант {o["id"]}: пустой text')
            else:
                otexts.append(norm(o['text']))
                check_text(qw, f'вариант {o["id"]}', o['text'])
            if 'why' in o:
                if not nonempty(o['why']):
                    err(qw, f'вариант {o["id"]}: пустой why')
                else:
                    check_text(qw, f'why {o["id"]}', o['why'])
        if len(set(oids)) != len(oids):
            err(qw, 'id вариантов повторяются')
        if len(set(otexts)) != len(otexts):
            err(qw, 'тексты вариантов повторяются')
        corr = q.get('correct')
        if not isinstance(corr, list) or not corr or len(set(corr)) != len(corr):
            err(qw, 'correct: непустой список без повторов')
            continue
        for c in corr:
            if c not in oids:
                err(qw, f'правильный вариант {c!r} не существует')
        for o in opts:
            if isinstance(o, dict) and o.get('id') not in corr and not nonempty(o.get('why')):
                err(qw, f'вариант {o.get("id")}: нет why, почему он неверен')
        t = q.get('type')
        if t == 'single':
            singles += 1
            if len(corr) != 1:
                err(qw, f'type single, а правильных {len(corr)}')
            else:
                lens = {o['id']: len(o.get('text', '')) for o in opts if isinstance(o, dict) and 'id' in o}
                best = max(lens.values())
                if lens.get(corr[0]) == best and list(lens.values()).count(best) == 1:
                    longest += 1
        elif t == 'multiple':
            multi += 1
            if len(corr) < 2:
                err(qw, 'type multiple, а правильный один: сделай single')
            if len(corr) >= len(opts):
                err(qw, 'все варианты правильные: так нельзя')
        else:
            err(qw, f'type {t!r}: single или multiple')
        for fld in ('text', 'explain', 'skill', 'code'):
            if nonempty(q.get(fld)):
                check_text(qw, fld, q[fld])
        sec = q.get('section')
        if nonempty(sec):
            ids = heads.get(sec)
            if not ids:
                err(qw, f'раздела «{sec}» нет в уроке (нужен точный текст заголовка ## или ###)')
            elif len(ids) > 1 or head_counts.get(ids[0], 0) > 0:
                err(qw, f'заголовок «{sec}» в уроке не уникален, ссылка неоднозначна')
        if nonempty(q.get('text')):
            full = norm(q['text'] + ' ' + q.get('code', ''))
            texts.append((qw, full))
            if full in all_texts:
                err(qw, f'дубль вопроса {all_texts[full]}')
            else:
                all_texts[full] = qw
    for a in range(len(texts)):
        for b in range(a + 1, len(texts)):
            sm = difflib.SequenceMatcher(None, texts[a][1], texts[b][1])
            if sm.real_quick_ratio() >= NEAR and sm.quick_ratio() >= NEAR and sm.ratio() >= NEAR:
                err(texts[b][0], f'почти дубль {texts[a][0]} (сходство {sm.ratio():.2f})')
    if qs and len(kinds) < 3:
        err(where, f'виды вопросов {sorted(kinds)}: нужно хотя бы 3 из {sorted(KINDS)}')
    if qs and multi < 3:
        err(where, f'вопросов с несколькими ответами {multi}, нужно не меньше 3')
    if singles and longest / singles > 0.5:
        err(where, f'в {longest} из {singles} вопросов с одним ответом правильный вариант самый длинный: выдаёт ответ')
    return {'n': len(qs), 'block': block, 'multi': multi, 'kinds': kinds}


def check_open(lesson, path, seen_ids, md_path):
    where = os.path.relpath(path, ROOT)
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    except (OSError, ValueError) as e:
        err(where, f'не читается: {e}')
        return 0
    if data.get('lesson') != lesson['id'] or data.get('topic') != lesson['topic']:
        err(where, 'lesson/topic не совпадают с _data/course.yml')
    key = lesson_key(lesson['id'])
    groups = {g.get('id') for g in data.get('groups', [])}
    nums = set()
    lesson_dir = os.path.dirname(md_path)
    qs = data.get('questions') or []
    no_marks = []
    if not qs:
        err(where, 'нет устных вопросов')
    for q in qs:
        qw = f'{where}#{q.get("id")}'
        if not re.fullmatch(rf'o{key}-\d{{2,3}}', str(q.get('id'))):
            err(qw, f'id: формат o{key}-NN')
        elif q['id'] in seen_ids:
            err(qw, 'id повторяется')
        else:
            seen_ids[q['id']] = where
        if not isinstance(q.get('n'), int) or q['n'] in nums:
            err(qw, 'номер n отсутствует или повторяется')
        nums.add(q.get('n'))
        for t in q.get('tags', []):
            if t not in TAGS:
                err(qw, f'метка {t!r}: одна из {sorted(TAGS)}')
        if not nonempty(q.get('q')) or not nonempty(q.get('answer')):
            err(qw, 'пустой вопрос или ответ')
            continue
        check_text(qw, 'q', q['q'])
        check_text(qw, 'answer', q['answer'])
        if '**Что хотят услышать:**' not in q['answer'] or '**Красный флаг:**' not in q['answer']:
            no_marks.append(q['id'])
        if q.get('group') and q['group'] not in groups:
            err(qw, f'группа {q["group"]!r} не описана в groups')
        if '{% raw' in q['answer']:
            err(qw, 'теги raw в данных не нужны')
        for m in re.finditer(r'\]\(([^)#\s]+\.md)(#[^)\s]*)?\)', q['answer']):
            if not os.path.isfile(os.path.normpath(os.path.join(lesson_dir, m.group(1)))):
                err(qw, f'ссылка на несуществующий урок {m.group(1)}')
        rest = re.sub(r'\]\(([^)#\s]+\.md)(#[^)\s]*)?\)', '', q['answer'])
        if re.search(r'\.md[)#]', rest):
            err(qw, 'текст «.md)» или «.md#» вне ссылки: include заменит его на .html')
    if no_marks:
        warn(where, f'без «**Что хотят услышать:**» или «**Красный флаг:**»: {len(no_marks)} ({", ".join(no_marks)})')
    if lesson['id'] not in ('13.4', '13.5') and not 8 <= len(qs) <= 12:
        warn(where, f'устных вопросов {len(qs)}, по правилу 8–12')
    return len(qs)


def check_site(lessons, site):
    """Проверка собранного сайта (_site): банк в странице урока, якоря разделов, JSON тем, ссылки ответов."""
    import html as htmllib
    import re as _re
    base = '/load-tester'
    by_topic = {}
    for l in lessons:
        key = lesson_key(l['id'])
        page = os.path.join(site, l['dir'], l['slug'] + '.html')
        where = os.path.relpath(page, site)
        if not os.path.isfile(page):
            err(where, 'страница урока не собрана')
            continue
        with open(page, encoding='utf-8') as f:
            h = f.read()
        ids = set(_re.findall(r'\sid="([^"]+)"', h))
        qp = os.path.join(QDIR, 'quiz', key + '.json')
        if os.path.isfile(qp):
            m = _re.search(r'<section class="quiz" data-quiz="([^"]+)".*?<script type="application/json" data-quiz-bank>(.*?)</script>', h, _re.S)
            if not m:
                err(where, 'нет блока «Проверь себя» с банком')
            else:
                if m.group(1) != l['id']:
                    err(where, f'data-quiz="{m.group(1)}", ожидался {l["id"]}')
                try:
                    bank = json.loads(m.group(2))
                except ValueError as e:
                    err(where, f'банк в странице не разбирается как JSON: {e}')
                    bank = {'questions': []}
                with open(qp, encoding='utf-8') as f:
                    src = json.load(f)
                if [q['id'] for q in bank.get('questions', [])] != [q['id'] for q in src['questions']]:
                    err(where, 'банк в странице не совпадает с _data')
                for q in bank.get('questions', []):
                    if gfm_id(q['section']) not in ids:
                        err(where, f'{q["id"]}: на странице нет якоря #{gfm_id(q["section"])}')
        op = os.path.join(QDIR, 'open', key + '.json')
        if os.path.isfile(op):
            with open(op, encoding='utf-8') as f:
                n = len(json.load(f)['questions'])
            sec = _re.search(r'id="вопросы-с-собеседований".*?(?=<h2[ >]|<section class="quiz"|$)', h, _re.S)
            got = len(_re.findall(r'<summary>Ответ</summary>', sec.group(0))) if sec else 0
            if got != n:
                err(where, f'устных ответов на странице {got}, в базе {n}')
        by_topic.setdefault(l['topic'], []).append(l)
    for t, ls in sorted(by_topic.items()):
        p = os.path.join(site, 'assets', 'questions', f'topic-{t:02d}.json')
        where = os.path.relpath(p, site)
        try:
            with open(p, encoding='utf-8') as f:
                data = json.load(f)
        except (OSError, ValueError) as e:
            err(where, f'не читается: {e}')
            continue
        if [x['id'] for x in data['lessons']] != [l['id'] for l in ls]:
            err(where, 'уроки темы не совпадают с course.yml')
            continue
        for x, l in zip(data['lessons'], ls):
            key = lesson_key(l['id'])
            for sub, fld in (('quiz', 'quiz'), ('open', 'open')):
                sp = os.path.join(QDIR, sub, key + '.json')
                want = 0
                if os.path.isfile(sp):
                    with open(sp, encoding='utf-8') as f:
                        want = len(json.load(f)['questions'])
                if len(x[fld]) != want:
                    err(where, f'урок {l["id"]}: {fld} {len(x[fld])}, в базе {want}')
            url = x['url']
            if not url.startswith(base + '/') or not os.path.isfile(os.path.join(site, url[len(base) + 1:])):
                err(where, f'урок {l["id"]}: битый адрес {url}')
                continue
            for q in x['open']:
                for href in _re.findall(r'href="([^"]+)"', q['a']):
                    href = htmllib.unescape(href)
                    if _re.match(r'^[a-z][a-z0-9+.-]*:', href, _re.I) or href.startswith('#'):
                        continue
                    target = href.split('#')[0]
                    full = os.path.normpath(os.path.join(os.path.dirname(url[len(base) + 1:]), target)) if not target.startswith('/') else target[len(base) + 1:]
                    if not os.path.isfile(os.path.join(site, full)):
                        err(where, f'{q["id"]}: битая ссылка в ответе {href}')
    ip = os.path.join(site, 'interview.html')
    if not os.path.isfile(ip):
        err('interview.html', 'страница подготовки не собрана')
    else:
        with open(ip, encoding='utf-8') as f:
            h = f.read()
        m = _re.search(r'<script type="application/json" data-prep-course(?:="")?>(.*?)</script>', h, _re.S)
        try:
            course = json.loads(m.group(1)) if m else None
        except ValueError:
            course = None
        if not course or sum(len(t['lessons']) for t in course) != len(lessons):
            err('interview.html', 'нет или неполный список тем и уроков')
        for js in ('quiz-core.js', 'quiz-ui.js', 'prep.js'):
            if js not in h:
                err('interview.html', f'не подключён {js}')


def main():
    lessons = load_course()
    if len(lessons) != 57:
        warn('_data/course.yml', f'уроков {len(lessons)} (в CLAUDE.md записано 57)')
    known = {lesson_key(l['id']) for l in lessons}
    for sub in ('quiz', 'open'):
        d = os.path.join(QDIR, sub)
        for name in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            if name.endswith('.json') and name[:-5] not in known:
                err(f'_data/questions/{sub}/{name}', 'файл не соответствует ни одному уроку')
    only = None
    if '--only' in sys.argv:
        only = set(sys.argv[sys.argv.index('--only') + 1].split(','))
    seen_ids, all_texts, stats = {}, {}, []
    n_open = 0
    for l in lessons:
        key = lesson_key(l['id'])
        if only is not None and key not in only:
            continue
        md = os.path.join(ROOT, l['dir'], l['slug'] + '.md')
        if not os.path.isfile(md):
            err(md, 'урок из course.yml не найден')
            continue
        with open(md, encoding='utf-8') as f:
            src = f.read()
        if src.count('{% include interview.html %}') != 1:
            err(os.path.relpath(md, ROOT), 'нужен ровно один {% include interview.html %} в разделе «Вопросы с собеседований»')
        heads, counts = headings(md)
        qp = os.path.join(QDIR, 'quiz', key + '.json')
        op = os.path.join(QDIR, 'open', key + '.json')
        if not os.path.isfile(qp):
            err(f'урок {l["id"]}', f'нет банка тестов _data/questions/quiz/{key}.json')
        else:
            st = check_quiz(l, qp, heads, counts, seen_ids, all_texts)
            if st:
                stats.append((l['id'], st))
        if not os.path.isfile(op):
            err(f'урок {l["id"]}', f'нет устных вопросов _data/questions/open/{key}.json')
        else:
            n_open += check_open(l, op, seen_ids, md)
    if '--site' in sys.argv:
        check_site(lessons, sys.argv[sys.argv.index('--site') + 1])
    n_quiz = sum(s['n'] for _, s in stats)
    if '--stats' in sys.argv:
        for lid, s in stats:
            print(f'{lid:>5}  вопросов {s["n"]:>2}  блок {s["block"]}  несколько ответов {s["multi"]:>2}  виды {",".join(sorted(s["kinds"]))}')
    for w in warnings:
        print('ВНИМАНИЕ', w)
    for e in errors:
        print('ОШИБКА', e)
    print(f'уроков {len(lessons)}, банков тестов {len(stats)}, тестовых вопросов {n_quiz}, устных {n_open}, ошибок {len(errors)}')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
