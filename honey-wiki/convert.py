#!/usr/bin/env python3
"""Конвертирует статьи honey-wiki/*.md в src/content/wiki/*.md для Astro content collection."""

import json
import os
import re

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SRC_DIR, "..", "src", "content", "wiki")

# Категории — сгруппированы по блокам тем из generate.py (10 блоков по 10 статей)
GROUPS = {
    "Термины": [
        "Мёд", "Нектар", "Падь", "Перга", "Прополис", "Пчелиный воск", "Маточное молочко",
        "Пчелиный яд", "Соты", "Забрус",
        "Кристаллизация мёда", "Влажность мёда", "Ферментация мёда", "Диастазное число",
        "Оксиметилфурфурол (ОМФ)", "Зрелость мёда", "Плотность мёда",
        "Гликемический индекс мёда", "Ферменты пчел", "Кислотность мёда",
    ],
    "Сорта мёда": [
        "Монофлорный мёд", "Полифлорный мёд", "Липовый мёд", "Гречишный мёд",
        "Акациевый мёд", "Подсолнечниковый мёд", "Каштановый мёд", "Донниковый мёд",
        "Вересковый мёд", "Кипрейный мёд",
        "Горчичный мёд", "Эспарцетовый мёд", "Рапсовый мёд", "Хлопковый мёд",
        "Дягилевый мёд", "Разнотравье", "Горный мёд", "Луговой мёд", "Падевый мёд",
        "Крем-мёд",
    ],
    "Пчёлы и породы": [
        "Медоносная пчела", "Пчелиная семья", "Матка пчелиная", "Рабочая пчела",
        "Трутень", "Расплод", "Роение", "Танец пчел", "Хоботок пчелы", "Жалящий аппарат",
        "Породы пчел", "Среднерусская пчела", "Карпатская пчела",
        "Карника (Краинская пчела)", "Кавказская пчела (Серая горная)",
        "Итальянская пчела", "Бакфаст", "Дальневосточная пчела",
        "Украинская степная пчела", "Селекция пчел",
    ],
    "Болезни и вредители": [
        "Варроатоз", "Нозематоз", "Аскосфероз", "Американский гнилец",
        "Европейский гнилец", "Восковая моль", "Пчелиный волк (Филант)",
        "Браулез", "Коллапс пчелиных семей (CCD)", "Обработка от клеща",
    ],
    "Апитерапия и здоровье": [
        "Апитерапия", "Антисептические свойства меда", "Мёд при простудных заболеваниях",
        "Мёд в косметологии", "Мёд при анемии", "Усвоение углеводов меда",
        "Аллергия на мёд", "Прополисная мазь", "Настойка пчелиного подмора",
        "Мёд и ЖКТ",
    ],
    "Пчеловодство": [
        "Роль пчел в экологии", "Роль пчел в сельском хозяйстве", "Кочевое пчеловодство",
        "Пестициды и пчелы", "Опылительная база", "Городское пчеловодство",
        "Экологически чистый мёд", "Улей", "Инвентарь пчеловода", "Медогонка",
        "Пчеловодство в древности", "Бортничество", "Изобретение рамочного улья",
        "Мёд в мифологии", "Вечный продукт", "Скорость полета пчелы",
        "Вместимость медового зобика", "Сколько цветов облетает пчела",
        "Продолжительность жизни пчелы", "Мёд в космосе",
    ],
}

TOPIC_CATEGORY = {}
for cat, topics in GROUPS.items():
    for t in topics:
        TOPIC_CATEGORY[t] = cat

TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya',
}


def slugify(title: str) -> str:
    s = title.lower()
    s = "".join(TRANSLIT.get(ch, ch) for ch in s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def wikilink_display(raw: str) -> str:
    """[[Target]] -> Target, [[Target|Display]] -> Display"""
    target, _, display = raw.partition("|")
    return (display or target).strip()


def wikilink_target(raw: str) -> str:
    target, _, _ = raw.partition("|")
    return target.strip()


def make_excerpt(body: str) -> str:
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        line = re.sub(r"^[-*]\s+", "", line)
        line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
        line = re.sub(r"\*(.+?)\*", r"\1", line)
        line = re.sub(r"\[\[([^\]]+)\]\]", lambda m: wikilink_display(m.group(1)), line)
        if len(line) > 20:
            return (line[:197] + "…") if len(line) > 200 else line
    return ""


def strip_double_heading(content: str, title: str) -> str:
    lines = content.splitlines()
    h1 = f"# {title}"
    idx = 0
    seen = 0
    while idx < len(lines) and seen < 2:
        if lines[idx].strip() == h1:
            seen += 1
        idx += 1
    return "\n".join(lines[idx:]).strip() + "\n"


def convert_links(body: str) -> str:
    def repl(m):
        target = wikilink_target(m.group(1))
        display = wikilink_display(m.group(1))
        slug = slugify(target)
        return f"[{display}](/wiki/{slug})"
    return re.sub(r"\[\[([^\]]+)\]\]", repl, body)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    files = sorted(f for f in os.listdir(SRC_DIR) if f.endswith(".md"))

    titles = [os.path.splitext(f)[0] for f in files]
    real_slugs = {slugify(t): t for t in titles}

    missing_category = [t for t in titles if t not in TOPIC_CATEGORY]
    if missing_category:
        print("ВНИМАНИЕ: нет категории для:", missing_category)

    all_link_targets = set()
    parsed = []
    for fname, title in zip(files, titles):
        with open(os.path.join(SRC_DIR, fname), encoding="utf-8") as fh:
            raw = fh.read()
        body = strip_double_heading(raw, title)
        for m in re.finditer(r"\[\[([^\]]+)\]\]", body):
            all_link_targets.add(wikilink_target(m.group(1)))
        parsed.append((title, body))

    stub_terms = {}
    for term in sorted(all_link_targets, key=lambda t: (not t[:1].isupper(), t)):
        slug = slugify(term)
        if slug not in real_slugs and slug not in stub_terms:
            stub_terms[slug] = term[0].upper() + term[1:] if term else term

    count = 0
    for title, body in parsed:
        slug = slugify(title)
        category = TOPIC_CATEGORY.get(title, "Термины")
        excerpt = make_excerpt(body)
        linked_body = convert_links(body)

        fm_title = title.replace('"', "'")
        fm_excerpt = excerpt.replace('"', "'")

        frontmatter = (
            "---\n"
            f'title: "{fm_title}"\n'
            f'category: "{category}"\n'
            f'excerpt: "{fm_excerpt}"\n'
            "draft: false\n"
            "---\n\n"
        )

        out_path = os.path.join(OUT_DIR, f"{slug}.md")
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write(frontmatter + linked_body)
        count += 1

    stubs_path = os.path.normpath(os.path.join(OUT_DIR, "..", "wiki-stubs.json"))
    with open(stubs_path, "w", encoding="utf-8") as fh:
        json.dump(stub_terms, fh, ensure_ascii=False, indent=2, sort_keys=True)

    print(f"Готово: {count} статей записано в {OUT_DIR}")
    print(f"Заглушек (ссылки без статьи): {len(stub_terms)} -> {stubs_path}")


if __name__ == "__main__":
    main()
