"""数字をひらがなの読みに直す（音声合成に渡す前。ElevenLabs は「1978年」「924番地」などの数字を読み違えることがある）

  numbers_to_kana("1991年7月22日、午後11時25分ごろ") → "せんきゅうひゃくきゅうじゅういちねんしちがつにじゅうににち、ごご…"

数字＋助数詞（年・月・日・時・分・人・歳・件・回・号室・番・ページ・か月・話・本・つ・億・万・千）をまとめて読む。
助数詞の前の音の変化（いっさい・ろっかい・はっぴゃく など）もここで扱う。知らない形は数字だけを読む。
"""
import re

D = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"]
HYAKU = {3: "さんびゃく", 6: "ろっぴゃく", 8: "はっぴゃく"}
SEN = {3: "さんぜん", 8: "はっせん"}


def read_int(n: int) -> str:
    """0〜9999億の整数の読み"""
    if n == 0:
        return "ぜろ"
    out = ""
    oku, n = divmod(n, 10 ** 8)
    man, n = divmod(n, 10 ** 4)
    if oku:
        out += read_under_man(oku) + "おく"
    if man:
        out += read_under_man(man) + "まん"
    if n:
        out += read_under_man(n)
    return out


def read_under_man(n: int) -> str:
    s = ""
    th, n = divmod(n, 1000)
    hu, n = divmod(n, 100)
    te, on = divmod(n, 10)
    if th:
        s += "せん" if th == 1 else SEN.get(th, D[th] + "せん")
    if hu:
        s += "ひゃく" if hu == 1 else HYAKU.get(hu, D[hu] + "ひゃく")
    if te:
        s += "じゅう" if te == 1 else D[te] + "じゅう"
    if on:
        s += D[on]
    return s


DAYS = {1: "ついたち", 2: "ふつか", 3: "みっか", 4: "よっか", 5: "いつか", 6: "むいか", 7: "なのか", 8: "ようか",
        9: "ここのか", 10: "とおか", 14: "じゅうよっか", 20: "はつか", 24: "にじゅうよっか"}
MONTHS = {4: "しがつ", 7: "しちがつ", 9: "くがつ"}
HOURS = {4: "よじ", 7: "しちじ", 9: "くじ"}
PEOPLE = {1: "ひとり", 2: "ふたり", 4: "よにん", 7: "ななにん"}
TSU = {1: "ひとつ", 2: "ふたつ", 3: "みっつ", 4: "よっつ", 5: "いつつ", 6: "むっつ", 7: "ななつ", 8: "やっつ", 9: "ここのつ"}
SAI = {0: "さい", 1: "いっさい", 8: "はっさい"}
KEN = {0: "けん", 1: "いっけん", 6: "ろっけん", 8: "はっけん"}
KAI = {0: "かい", 1: "いっかい", 6: "ろっかい", 8: "はっかい"}
FUN = {0: "ふん", 1: "いっぷん", 3: "さんぷん", 4: "よんぷん", 6: "ろっぷん", 8: "はっぷん"}
HON = {0: "ほん", 1: "いっぽん", 3: "さんぼん", 6: "ろっぽん", 8: "はっぽん"}
KAGETSU = {0: "かげつ", 1: "いっかげつ", 6: "ろっかげつ", 8: "はっかげつ"}


TAIL10 = {"ふん": "ぷん", "ほん": "ぽん"}


def _counted(n: int, table: dict) -> str:
    """末尾の数字で音が変わる助数詞（いっさい、ろっかい、じゅっけん、じゅっぷん など）"""
    last = n % 10
    if n % 100 == 10:  # 10, 110 … は「じゅっ」＋助数詞
        return (read_int(n - 10) if n > 10 else "") + "じゅっ" + TAIL10.get(table[0], table[0])
    if last and last in table:
        return (read_int(n - last) if n > last else "") + table[last]
    return read_int(n) + table[0]


def _day(n: int) -> str:
    if n in DAYS:
        return DAYS[n]
    if n % 10 == 7:  # 17日・27日は「しちにち」
        return (read_int(n - 7) if n > 7 else "") + "しちにち"
    return read_int(n) + "にち"


def _num(s: str) -> int:
    return int(s.replace(",", ""))


RULES = [
    (r"(\d+)万(\d+)千", lambda m: read_int(_num(m[1])) + "まん" + read_under_man(_num(m[2]) * 1000)),
    (r"(\d+)億", lambda m: read_int(_num(m[1])) + "おく"),
    (r"(\d+)万", lambda m: read_int(_num(m[1])) + "まん"),
    (r"(\d+)か月", lambda m: _counted(_num(m[1]), KAGETSU)),
    (r"(\d+)日(後|間|目)", lambda m: _day(_num(m[1])) + {"後": "ご", "間": "かん", "目": "め"}[m[2]]),
    (r"(\d+)時間", lambda m: HOURS.get(_num(m[1]), read_int(_num(m[1])) + "じ") + "かん"),
    (r"(\d{3,4})年", lambda m: read_int(_num(m[1])) + "ねん"),
    (r"(\d+)年", lambda m: ("よ" if _num(m[1]) == 4 else read_int(_num(m[1]))) + "ねん"),
    (r"(\d+)月", lambda m: MONTHS.get(_num(m[1]), read_int(_num(m[1])) + "がつ")),
    (r"(\d+)日", lambda m: _day(_num(m[1]))),
    (r"(\d+)時", lambda m: HOURS.get(_num(m[1]), read_int(_num(m[1])) + "じ")),
    (r"(\d+)分", lambda m: _counted(_num(m[1]), FUN)),
    (r"(\d+)人", lambda m: PEOPLE.get(_num(m[1]), read_int(_num(m[1])) + "にん")),
    (r"(\d+)歳", lambda m: _counted(_num(m[1]), SAI)),
    (r"(\d+)件", lambda m: _counted(_num(m[1]), KEN)),
    (r"(\d+)回", lambda m: _counted(_num(m[1]), KAI)),
    (r"(\d+)本", lambda m: _counted(_num(m[1]), HON)),
    (r"(\d+)つ", lambda m: TSU.get(_num(m[1]), read_int(_num(m[1])))),
    (r"(\d+)号室", lambda m: read_int(_num(m[1])) + "ごうしつ"),
    (r"(\d+)番地", lambda m: read_int(_num(m[1])) + "ばんち"),
    (r"(\d+)番通り", lambda m: read_int(_num(m[1])) + "ばんどおり"),
    (r"(\d+)番", lambda m: read_int(_num(m[1])) + "ばん"),
    (r"(\d+)話", lambda m: read_int(_num(m[1])) + "わ"),
    (r"第(\d+)級", lambda m: "だい" + read_int(_num(m[1])) + "きゅう"),
    (r"第(\d+)", lambda m: "だい" + read_int(_num(m[1]))),
    (r"(\d[\d,]*)", lambda m: read_int(_num(m[1]))),
]


def numbers_to_kana(text: str) -> str:
    for pat, fn in RULES:
        text = re.sub(pat, fn, text)
    return text


if __name__ == "__main__":
    import sys
    for line in sys.argv[1:]:
        print(numbers_to_kana(line))
