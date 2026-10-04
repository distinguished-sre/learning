"""Общее для скриптов проверки: корень репозитория, список курсов, выбор по --course.

Курс <name>: уроки в <name>/, порядок и темы в _data/courses/<name>.yml.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COURSES = ("devops", "load-tester", "monitoring")


def course_file(course):
    return ROOT / "_data" / "courses" / f"{course}.yml"


def add_course_arg(parser, default=None):
    """--course devops|load-tester|monitoring; без него default (None = все курсы)."""
    parser.add_argument("--course", choices=COURSES, default=default,
                        help="курс" + ("" if default else " (по умолчанию все, у которых есть данные)"))


def select(course):
    """Курсы для проверки: заданный или все, у которых есть файл данных.
    Курс без файла данных пропускается с сообщением, не падает."""
    out = []
    for c in ([course] if course else COURSES):
        if course_file(c).is_file():
            out.append(c)
        else:
            print(f"курс {c}: нет {course_file(c).relative_to(ROOT)}, пропускаю", file=sys.stderr)
    return out
