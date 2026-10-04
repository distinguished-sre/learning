#!/usr/bin/env python3
"""Читаемость теории: разделы «Зачем это нужно», «Картина целиком», «Теория».

Правила в tools/theory-style.md. Запуск из корня репозитория:
  python3 tools/readability.py                 # сводка по всем урокам
  python3 tools/readability.py 8.2             # подробности: длинные предложения, стоп-слова
  python3 tools/readability.py --json > r.json
  python3 tools/readability.py --terms 8.2     # термины, введённые словариками до урока 8.2
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit import ROOT, lessons, strip_code, sections, glossary  # noqa: E402

PARTS = ("Зачем это нужно", "Картина целиком", "Теория")
LABELS = re.compile(r"\*\*(Зачем (это|он|она|они) существу\w+|Аналогия|Как (это )?устроено|Разобранный пример|Что путают)\.?\*\*")
DEFLIST = re.compile(r"^\s*[-*] \*\*[^*]+\*\*( \([A-Za-z][^)]*\))?:")
STOP = re.compile(r"(?<!\w)(явля\w+|осуществля\w+|данн(ый|ая|ое|ого|ой|ом)|в рамках|следует отметить|необходимо|производится|посредством|в случае если|ввиду|позволя\w+(?!\s+(тебе|нам)))(?!\w)", re.I)
ENG = re.compile(r"\((?=[^)]*[A-Za-z]{2})[^)а-яёА-ЯЁ]*\)")
SENT = re.compile(r"(?:(?<=[.!?…])|(?<=[.!?…][»\")]))\s+(?=[А-ЯЁA-Z0-9«\"(*`])")
ITEM = re.compile(r"^([-*]|\d+\.) ")


def prose(rows, a, b):
    """Абзацы прозы без кода, таблиц, html, виджетов и заголовков."""
    paras, cur = [], []
    skip_html = False
    for i, line, code in rows:
        if not a < i <= b:
            continue
        s = line.strip()
        if code or s.startswith(("|", "#", "<", "{:", "```", "{%")) or not s:
            if cur:
                paras.append(" ".join(cur))
                cur = []
            continue
        s = re.sub(r"^>\s*", "", s)
        if ITEM.match(s) and cur:  # пункт списка: отдельный абзац
            paras.append(" ".join(cur))
            cur = []
        cur.append(s)
    if cur:
        paras.append(" ".join(cur))
    return paras


def clean(p):
    p = re.sub(r"`[^`]*`", "X", p)
    p = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", p)
    return p.replace("**", "")


def analyze(path):
    text = path.read_text()
    rows = strip_code(text)
    secs = sections(rows)
    out = {"words": 0, "sent": 0, "long": [], "big_para": 0, "labels": 0, "deflist": 0,
           "stop": [], "eng": 0, "key": 0, "predict": 0, "check": 0, "h3": 0}
    for name, a, b in secs:
        if name not in PARTS:
            continue
        for i, line, code in rows:
            if a < i <= b and not code:
                out["labels"] += len(LABELS.findall(line))
                out["deflist"] += bool(DEFLIST.match(line))
                out["key"] += "**Главное:**" in line
                out["predict"] += "**Прикинь сам:**" in line
                out["check"] += "**Проверь понимание:**" in line
                out["h3"] += line.startswith("### ")
        for p in prose(rows, a, b):
            c = clean(p)
            out["eng"] += len(ENG.findall(p))
            out["stop"] += [m.group(0).strip() for m in STOP.finditer(c)]
            ss = [s for s in SENT.split(c) if s.split()]
            out["sent"] += len(ss)
            out["big_para"] += len(ss) > 4
            for s in ss:
                n = len(s.split())
                out["words"] += n
                if n > 25:
                    out["long"].append((n, s[:120]))
    out["avg"] = round(out["words"] / out["sent"], 1) if out["sent"] else 0
    return out


def terms_before(lid):
    """Термины словариков всех уроков до lid (порядок из course.yml)."""
    res = []
    for l in lessons():
        if l["id"] == lid:
            break
        if not l["path"].exists():
            continue
        rows = strip_code(l["path"].read_text())
        res += [(l["id"], t) for t in glossary(rows, sections(rows))]
    return res


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--terms" in sys.argv:
        if not args or args[0] not in {l["id"] for l in lessons()}:
            sys.exit("укажи номер урока из _data/course.yml, например --terms 8.2")
        for lid, t in terms_before(args[0]):
            print(f"{lid}\t{t}")
        return
    res = []
    for l in lessons():
        if l["path"].exists() and (not args or l["id"] in args):
            r = analyze(l["path"])
            r["id"], r["path"] = l["id"], str(l["path"].relative_to(ROOT))
            res.append(r)
    if "--json" in sys.argv:
        json.dump(res, sys.stdout, ensure_ascii=False, indent=1)
        return
    if not args:
        print("урок   слов  ср.предл  >25сл  абз>4  ярлыки  списки  стоп  англ  главное  прикинь")
        for r in res:
            print(f'{r["id"]:5} {r["words"]:6} {r["avg"]:8} {len(r["long"]):6} {r["big_para"]:6}'
                  f' {r["labels"]:7} {r["deflist"]:7} {len(r["stop"]):5} {r["eng"]:5} {r["key"]:8} {r["predict"]:8}')
        return
    for r in res:
        print(f'## {r["id"]} {r["path"]}: {r["words"]} слов, {r["sent"]} предложений, в среднем {r["avg"]}')
        print(f'ярлыки старого шаблона {r["labels"]}, списки определений {r["deflist"]}, абзацев >4 предложений {r["big_para"]}')
        print(f'англ. в скобках {r["eng"]}, «Главное» {r["key"]}/{r["h3"]} разделов, «Прикинь сам» {r["predict"]}, «Проверь понимание» {r["check"]}')
        print("стоп-слова:", ", ".join(r["stop"]) or "нет")
        print("предложения длиннее 25 слов:")
        for n, s in r["long"]:
            print(f"  [{n}] {s}")


if __name__ == "__main__":
    main()
