"""Проверка синтаксиса блоков кода в уроках без запуска: bash -n, py_compile, node --check.
Python и JS проверяются только если блок начинается с import (полный файл), остальное фрагменты."""
import glob, pathlib, re, subprocess, sys, tempfile
checks = {'bash': (['bash', '-n'], '.sh'), 'python': (['python3', '-m', 'py_compile'], '.py'),
          'javascript': (['node', '--check'], '.mjs'), 'js': (['node', '--check'], '.mjs')}
bad = total = 0
for f in sorted(glob.glob('[0-9][0-9]-*/*.md')):
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
            print(f'{f}:{text[:m.start()].count(chr(10)) + 2}: {lang}: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else ""}')
print(f'проверено блоков: {total}, с ошибками: {bad}')
sys.exit(1 if bad else 0)
