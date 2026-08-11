#!/usr/bin/env python3
"""Пакетный генератор статей для закрытия битых wikilinks."""
import os, re, sys, time, json
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url="https://api.deepseek.com/v1",
)

SYS = """Ты эксперт-апиолог. Напиши энциклопедическую статью Markdown объёмом 2000-2500 слов.
Формат: структурированный список с вложенными пунктами. Используй перекрёстные ссылки [[Термин]].
Язык: строгий научный."""


def clean(t):
    return re.sub(r'[/\\?%*:|"<>]', '-', t) + '.md'


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 batch_gen.py topics.json")
        sys.exit(1)

    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        topics = json.load(f)

    output_dir = os.path.dirname(os.path.abspath(__file__))
    total = len(topics)
    ok = skip = err = 0

    for i, topic in enumerate(topics, 1):
        fn = clean(topic)
        path = os.path.join(output_dir, fn)

        if os.path.exists(path):
            print(f"[{i}/{total}] ⏭ {topic} (уже есть)", flush=True)
            skip += 1
            continue

        print(f"[{i}/{total}] ✍️ {topic} ...", flush=True)
        try:
            r = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": SYS},
                    {"role": "user", "content": f"Напиши статью: {topic}"},
                ],
                temperature=0.7,
                max_tokens=16384,
                timeout=120,
            )
            with open(path, "w", encoding="utf-8") as f:
                f.write(f"# {topic}\n\n{r.choices[0].message.content}")
            wc = len(r.choices[0].message.content.split())
            print(f"  ✅ {wc} слов", flush=True)
            ok += 1
            time.sleep(3)
        except Exception as e:
            print(f"  ❌ {e}", flush=True)
            err += 1
            time.sleep(15)

    print(f"\n🏁 OK:{ok} skip:{skip} err:{err}")


if __name__ == "__main__":
    main()
