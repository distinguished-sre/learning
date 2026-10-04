"""Проверка синтаксиса блоков кода в уроках без запуска: bash -n, py_compile, node --check.
Python и JS проверяются только если блок начинается с import (полный файл), остальное фрагменты.
Запуск из корня: python3 tools/check_snippets.py [--course devops|load-tester|monitoring] (по умолчанию все курсы, у которых есть данные)."""
import argparse, glob, os, pathlib, re, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from courses import ROOT, add_course_arg, select
ap = argparse.ArgumentParser()
add_course_arg(ap)
courses = select(ap.parse_args().course)
checks = {'bash': (['bash', '-n'], '.sh'), 'python': (['python3', '-m', 'py_compile'], '.py'),
          'javascript': (['node', '--check'], '.mjs'), 'js': (['node', '--check'], '.mjs')}
bad = total = 0
files = [f for c in courses for f in sorted(glob.glob(f'{ROOT}/{c}/[0-9][0-9]-*/*.md'))]
for f in files:
    text = pathlib.Path(f).read_text()
    for m in re.finditer(r'^```(bash|python|javascript|js)\n(.*?)^```', text, re.S | re.M):
        lang, code = m.groups()
        # Полные файлы: Python и JS только если блок начинается с import (иначе это фрагмент).
        if lang != 'bash' and not re.match(r'import |from \S+ import |#!', code):
            continue
        cmd, ext = checks[lang]
        with tempfile.NamedTemporaryFile('w', suffix=ext) as tmp:
            tmp.write(code); tmp.flush()
            r = subprocess.run(cmd + [tmp.name], capture_output=True, text=True)
        total += 1
        if r.returncode:
            bad += 1
            print(f'{os.path.relpath(f, ROOT)}:{text[:m.start()].count(chr(10)) + 2}: {lang}: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else ""}')
print(f'проверено блоков: {total}, с ошибками: {bad}')
sys.exit(1 if bad else 0)
