#!/usr/bin/env python3
"""Конвертирует НОВУЮ порцию статей honey-wiki/*.md (2-я и последующие партии)
в src/content/wiki/*.md. Пропускает уже сконвертированные статьи и "заглушки"
(статьи без реального содержания), автоматически определяет категорию по
ключевым словам, разрешает коллизии слагов (е/ё, регистр) в пользу более
длинной версии статьи."""

import json
import os
import re

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SRC_DIR, "..", "src", "content", "wiki")
STUBS_PATH = os.path.normpath(os.path.join(OUT_DIR, "..", "wiki-stubs.json"))

STUB_MARKER = "Заглушка. Статья будет написана позже."

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


def strip_leading_headings(content: str) -> str:
    """Убирает 1-2 заголовка h1 в начале статьи (голый title, затем title с подзаголовком)."""
    lines = content.splitlines()
    idx = 0
    while idx < len(lines):
        line = lines[idx].strip()
        if line == "" or line.startswith("# "):
            idx += 1
            continue
        break
    return "\n".join(lines[idx:]).strip() + "\n"


def strip_frontmatter(content: str) -> str:
    return re.sub(r"^---\n.*?\n---\n", "", content, flags=re.S)


def convert_links(body: str) -> str:
    def repl(m):
        target = wikilink_target(m.group(1))
        display = wikilink_display(m.group(1))
        slug = slugify(target)
        return f"[{display}](/wiki/{slug})"
    return re.sub(r"\[\[([^\]]+)\]\]", repl, body)


# ---------------------------------------------------------------- category classifier

def norm(t):
    return t.lower().replace("ё", "е")


PLANTS = ["акация", "вереск", "гречиха", "донник", "ива", "иван-чай", "кипрей", "клевер",
          "клен", "лаванда", "липа", "люцерна", "малина", "мелисса", "подсолнечник", "рапс",
          "синяк обыкновенный", "фацелия", "эспарцет", "золотарник", "хлопч"]

STANDARDS_KW = ["гост", "iso", "haccp", "кодекс алиментариус", "codex", "тр тс", "сертификация",
    "хроматография", "спектрометрия", "электрофорез", "elisa", "рефрактометрия", "реология меда",
    "изотопный анализ", "вэжх", "crispr", "talen", "ветеринарно-санитарн", "ветеринарное свидетельство",
    "ветеринарные правила", "паспорт пасеки", "регистрация пасеки", "продовольственная безопасность",
    "фальсификация меда", "определение ботанического происхождения", "пыльцевой анализ",
    "мелиссопалинология", "палинология", "сенсорный анализ меда", "масс-спектрометрия", "агрономия",
    "агроэкология", "агролесоводство", "агрохимия", "агроландшафт", "агроэкосистема", "агро-индустрия",
    "точное земледелие", "сельскохозяйственные информационные системы", "цифровое сельское хозяйство",
    "биотехнология", "нейробиология", "эпигенетика", "геномная селекция", "гаплодиплоидия",
    "хитин", "хитозан", "целлюлоза", "крахмал", "коллаген", "аминокислоты", "белки",
    "полисахариды", "углеводы", "сахароза", "фруктоза", "глюкоза", "трегалоза", "гликолиз",
    "глюконеогенез", "цикл кальвина", "фотосинтез", "фотодыхание", "пентозофосфатный",
    "антибиотикорезистентность", "осмофильные дрожжи", "дрожжи", "биохимия",
    "мелиттин", "энтомология", "апидология", "апиология", "апимониторинг",
    "роль пчел в сельском хозяйстве", "роль пчел в экологии"]

DISEASE_KW = ["гнилец", "гнильц", "нозематоз", "варроа", "акарапидоз", "аскосфероз", "браулез",
    "тропилелапсоз", "вирус", "клещ", "вредител", "паралич пчел", "мешотчатый расплод", "меланоз",
    "сальмонеллез", "септицемия", "гафниоз", "амебиаз", "падевый токсикоз", "коллапс пчелиных семей",
    "шершень", "моль", "мыши в зимовнике", "муравьи на пасеке", "щурка", "пестициды", "неоникотиноиды",
    "nosema", "paenibacillus", "varroa destructor", "аспергиллез", "пчелиный волк", "филант",
    "синдром разрушения колоний"]

HEALTH_KW = ["апитерапия", "аллергия", "анафилактический", "косметолог", "мед и жкт", "простудн",
    "анеми", "пчелиного подмора", "прополисная мазь", "диабет", "альцгеймер", "паркинсон", "акне",
    "антибактериальн", "антисептич"]

ANATOMY_KW = ["железа", "железы", "феромон", "гормон", "крыл", "глаза пчелы", "усики", "мандибул",
    "кишечник пчелы", "дыхальца", "нервная система", "гемолимфа", "жировое тело", "мальпигиевы",
    "сперматека", "спермоприемник", "мозг пчелы", "хоботок", "жалящий аппарат", "жало",
    "обоняние", "терморегуляция", "полиандрия", "партеногенез", "гаплодиплоид", "каста пчел",
    "касты пчел", "полиэтизм", "трофаллаксис", "танец", "танцы", "ориентация", "навигация",
    "солнечный компас", "магнитная навигация", "обучение у пчел", "память и обучение",
    "когнитивные способности", "сон пчел", "циркадные ритмы", "филогеография", "эусоциальность",
    "гигиеническое поведение", "обонятельная память", "обонятел", "танцевальный",
    "этология", "зоосемиотика", "вителлогенин", "ювенильный гормон", "октапамин", "дофамин",
    "серотонин", "мелатонин", "адреналин", "инсулин", "гамк", "стероидные гормоны", "джонстонов орган",
    "физиология насекомых", "физиология пчелы", "анатомия медоносной пчелы", "линька членистоногих",
    "экдизон", "экдистероид", "гистамин", "семиохимические", "корзиночка", "ингибин"]

BEEKEEPING_KW = ["рамк", "рамоч", "дымарь", "стамеска", "пасе", "зимовник", "омшаник", "роевня",
    "роевн", "нуклеус", "отвод", "вывод маток", "кормушка", "пыльцеуловитель", "вощина", "леток",
    "магазинная надставка", "кочев", "календарь пчеловода", "инвентарь", "подкормка", "сироп",
    "канди", "породное районирование", "осмотр пчелиной семьи", "ревизия", "откачка меда",
    "медогонка", "цифровизация пчеловодства", "цифровое пчеловодство",
    "объединение", "роение", "роевое состояние", "роевые маточники", "естественное роение",
    "гнездо", "расширение гнезда", "прививка личинок", "подсадка матки", "тихая смена",
    "искусственное осеменение", "инструментальное осеменение", "карантин в пчеловодстве",
    "маточное воспитание", "маточное разведение", "натуральное пчеловодство", "органическое пчеловодство",
    "рациональное пчеловодство", "экологическое пчеловодство", "бортевое пчеловодство",
    "бортничество", "колодное пчеловодство", "рамочное пчеловодство", "метод чайкина", "метод ковалева",
    "утепление улья", "вентиляция", "сырость в улье", "пчелиное пространство", "разделительная решетка",
    "пчелоудалитель", "пасечный захват", "опыление", "опылительная база", "пчеловодство",
    "клеточка", "колода", "сапетка", "лежак", "кормовые запасы", "облет", "воровство", "пчелопакет",
    "прилет", "городское пчеловодство", "двухматочное", "изобретение рамочного улья", "улей",
    "зимовк", "зимний клуб", "зимн", "продуктивность пчелиной семьи", "продукты пчеловодства",
    "противоро"]

BREEDS_KW = ["пород", "apis ", "карника", "бакфаст", "карпатск", "итальянск", "кавказск",
    "среднерусск", "украинск степн", "краинск", "дальневосточная пчела", "темная европейская пчела",
    "аборигенные пчелы", "африканизированные пчелы", "пчела медоносная", "медоносная пчела",
    "пчелиная матка", "матка пчелиная", "матка", "трутен", "расплод", "пчелиная семья", "соты",
    "пчелиные соты", "пчелиная ячейка", "трутневая ячейка", "трутневый расплод", "рабочая пчела",
    "кормилицы", "плодная матка", "яйценоскость матки", "маточник", "маточ", "генетика пчел",
    "генетика и селекция", "селекция пчел", "гетерозис", "апомиксис",
    "геном медоносной пчелы", "суперорганизм", "пчелы", "шмели", "биология пчелиной семьи",
    "болезни пчел"]

OVERRIDE = {
    "матoчное вещество": "Пчёлы и породы",
    "ботаника": "Медоносные растения",
}

CATEGORIES = [
    "Термины", "Сорта мёда", "Пчёлы и породы", "Болезни и вредители",
    "Апитерапия и здоровье", "Пчеловодство", "Анатомия и физиология",
    "Медоносные растения", "Наука и стандарты",
]


def classify(title: str) -> str:
    t = norm(title)
    if t in OVERRIDE:
        return OVERRIDE[t]
    if any(k in t for k in STANDARDS_KW):
        return "Наука и стандарты"
    if any(p in t for p in PLANTS) and "мед" not in t:
        return "Медоносные растения"
    if "как медонос" in t:
        return "Медоносные растения"
    if any(k in t for k in DISEASE_KW):
        return "Болезни и вредители"
    if any(k in t for k in HEALTH_KW):
        return "Апитерапия и здоровье"
    if any(k in t for k in ANATOMY_KW):
        return "Анатомия и физиология"
    if any(k in t for k in BEEKEEPING_KW):
        return "Пчеловодство"
    if any(k in t for k in BREEDS_KW):
        return "Пчёлы и породы"
    if "мед" in t and not t.startswith("мед в") and not t.startswith("мед при") and not t.startswith("мед и "):
        return "Сорта мёда"
    return "Термины"


def main():
    files = sorted(f for f in os.listdir(SRC_DIR) if f.endswith(".md"))
    existing_slugs = set(
        os.path.splitext(f)[0] for f in os.listdir(OUT_DIR) if f.endswith(".md")
    )

    # 1) partition into stub vs full, parse
    full_by_title = {}
    for fname in files:
        title = os.path.splitext(fname)[0]
        with open(os.path.join(SRC_DIR, fname), encoding="utf-8") as fh:
            raw = fh.read()
        if STUB_MARKER in raw:
            continue
        body_no_fm = strip_frontmatter(raw)
        body = strip_leading_headings(body_no_fm)
        full_by_title[title] = body

    # 2) resolve slug collisions among full articles -> keep longest body
    slug_owner = {}  # slug -> (title, body)
    skipped_dupes = []
    for title, body in full_by_title.items():
        slug = slugify(title)
        if slug in existing_slugs:
            continue  # already published in an earlier batch, don't touch
        if slug in slug_owner:
            other_title, other_body = slug_owner[slug]
            if len(body) > len(other_body):
                skipped_dupes.append(other_title)
                slug_owner[slug] = (title, body)
            else:
                skipped_dupes.append(title)
            continue
        slug_owner[slug] = (title, body)

    # 3) collect ALL wikilink targets across every full article (old batch already
    #    converted + this new batch) to keep wiki-stubs.json complete
    all_link_targets = set()
    for title, body in full_by_title.items():
        for m in re.finditer(r"\[\[([^\]]+)\]\]", body):
            all_link_targets.add(wikilink_target(m.group(1)))
    for fname in os.listdir(OUT_DIR):
        if not fname.endswith(".md"):
            continue
        with open(os.path.join(OUT_DIR, fname), encoding="utf-8") as fh:
            raw = fh.read()
        for m in re.finditer(r"\[\[([^\]]+)\]\]", raw):
            all_link_targets.add(wikilink_target(m.group(1)))

    real_slugs_after = set(existing_slugs) | set(slug_owner.keys())

    stub_terms = {}
    for term in sorted(all_link_targets, key=lambda t: (not t[:1].isupper(), t)):
        slug = slugify(term)
        if slug not in real_slugs_after and slug not in stub_terms:
            stub_terms[slug] = term[0].upper() + term[1:] if term else term

    # 4) write new real articles
    cat_counts = {c: 0 for c in CATEGORIES}
    count = 0
    for slug, (title, body) in sorted(slug_owner.items()):
        category = classify(title)
        cat_counts[category] += 1
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

    with open(STUBS_PATH, "w", encoding="utf-8") as fh:
        json.dump(stub_terms, fh, ensure_ascii=False, indent=2, sort_keys=True)

    print(f"Новых статей записано: {count}")
    print(f"Пропущено дублей (совпадающий слаг, взята более длинная версия): {len(skipped_dupes)}")
    print(f"Заглушек (ссылки без статьи): {len(stub_terms)} -> {STUBS_PATH}")
    print("\nПо категориям:")
    for c in CATEGORIES:
        print(f"  {c}: {cat_counts[c]}")


if __name__ == "__main__":
    main()
