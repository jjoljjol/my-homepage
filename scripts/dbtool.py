#!/usr/bin/env python3
"""Startup DB maintenance tool (Python 3 standard library only).

  python3 scripts/dbtool.py archive          move expired items to archive/, rewrite the CSV
  python3 scripts/dbtool.py validate         offline checks (schema, sources, freshness); exit 1 on errors
  python3 scripts/dbtool.py check [--id N]   fetch each source_url and look for the claimed figures

`check` is an aid, not proof: PDFs and JavaScript-rendered pages cannot be read,
and a match does not replace reading the notice yourself. Only a person should
set `verified_at` in data/startup_db.json.
"""
import argparse
import csv
import json
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACTIVE = ROOT / "data" / "startup_db.json"
ARCHIVE = ROOT / "archive" / "startup_db.json"
CSV_OUT = ROOT / "data" / "startup_db.csv"

REQUIRED = ["id", "title", "region", "category", "benefit", "deadline", "organ", "link", "type", "detail"]
OPTIONAL = {"source_url": "", "verified_at": "", "verified_note": ""}
CSV_FIELDS = REQUIRED + list(OPTIONAL)
STALE_DAYS = 30  # keep in sync with STALE_DAYS in script.js
DATE_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")


def today():
    return datetime.now(timezone(timedelta(hours=9))).date()  # KST


def load(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def save(path, items):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def deadline_date(item):
    m = DATE_RE.search(str(item.get("deadline", "")))
    if not m:
        return None
    try:
        return date(int(m[1]), int(m[2]), int(m[3]))
    except ValueError:
        return None


def is_expired(item, t):
    """Same rule as parseDeadline() in script.js."""
    d = deadline_date(item)
    if d:
        return d < t
    return "마감" in str(item.get("deadline", ""))


def normalize(item):
    item.pop("d_day", None)  # a stored D-day goes stale; the site computes it
    for key, default in OPTIONAL.items():
        item.setdefault(key, default)
    return item


def write_csv(items):
    with CSV_OUT.open("w", encoding="utf-8-sig", newline="") as f:  # BOM so Excel reads Korean
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(items)


# ---------------------------------------------------------------- archive
def cmd_archive(_args):
    t = today()
    active = [normalize(i) for i in load(ACTIVE)]
    archive = [normalize(i) for i in load(ARCHIVE)]
    known = {i.get("id") for i in archive}
    keep, moved = [], []
    for it in active:
        (moved if is_expired(it, t) else keep).append(it)
    for it in moved:
        if it.get("id") in known:
            print(f"! id={it.get('id')} 은(는) 보관함에 이미 있어 건너뜁니다 (active에서는 제거)")
            continue
        it["archived_at"] = t.isoformat()
        archive.append(it)
    save(ACTIVE, keep)
    save(ARCHIVE, archive)
    write_csv(keep)
    print(f"진행 중 {len(keep)}건 유지 · 보관함으로 이동 {len(moved)}건 · 보관함 총 {len(archive)}건")
    for it in moved:
        print(f"  → [{it.get('id')}] {it.get('title')} ({it.get('deadline')})")


# --------------------------------------------------------------- validate
def cmd_validate(_args):
    t = today()
    errors, warns = [], []
    rows = [("data", i) for i in load(ACTIVE)] + [("archive", i) for i in load(ARCHIVE)]
    seen, verified = set(), 0
    for where, it in rows:
        name = f"[{where}] id={it.get('id')} {str(it.get('title', ''))[:26]}"
        for k in REQUIRED:
            if it.get(k) in (None, ""):
                errors.append(f"{name}: '{k}' 값이 없습니다")
        if it.get("id") in seen:
            errors.append(f"{name}: id가 중복됩니다")
        seen.add(it.get("id"))
        for k in ("link", "source_url"):
            v = it.get(k) or ""
            if v and not re.match(r"https?://", v):
                errors.append(f"{name}: {k}가 http(s) 주소가 아닙니다")
        src = it.get("source_url") or ""
        if src and re.match(r"https?://[^/]+/?$", src):
            warns.append(f"{name}: source_url이 기관 홈페이지로 보입니다. 공고 원문 주소를 넣으세요")
        va = it.get("verified_at") or ""
        if va:
            try:
                d = date.fromisoformat(va)
            except ValueError:
                errors.append(f"{name}: verified_at 형식이 YYYY-MM-DD가 아닙니다")
            else:
                if not src:
                    errors.append(f"{name}: verified_at이 있는데 source_url이 없습니다")
                if d > t:
                    errors.append(f"{name}: verified_at이 미래 날짜입니다")
                elif (t - d).days > STALE_DAYS:
                    warns.append(f"{name}: 확인한 지 {(t - d).days}일 지났습니다. 재확인하세요")
                elif src:
                    verified += 1
                if not (it.get("verified_note") or ""):
                    warns.append(f"{name}: verified_note에 무엇을 대조했는지 적어 두세요")
        if where == "data":
            if is_expired(it, t):
                warns.append(f"{name}: 마감되었습니다. `python3 scripts/dbtool.py archive` 를 실행하세요")
            dl = str(it.get("deadline", ""))
            if deadline_date(it) is None and not re.search(r"상시|마감", dl):
                warns.append(f"{name}: 마감 형식을 알 수 없어 '확인 필요'로 표시됩니다 ({dl!r})")
    active_n = len([1 for w, _ in rows if w == "data"])
    print(f"검사 {len(rows)}건 (진행 {active_n} · 보관 {len(rows) - active_n}) · 원문 확인 완료 {verified}건")
    for w in warns:
        print("경고:", w)
    for e in errors:
        print("오류:", e)
    if errors:
        sys.exit(1)
    print("오류 없음" + (" (경고 확인 필요)" if warns else ""))


# ------------------------------------------------------------------ check
class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self._skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript") and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def squash(s):
    return re.sub(r"[\s,]+", "", s)  # compare without spaces/commas: "2,000만 원" == "2000만원"


def fetch_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (startup-db factcheck)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        raw, ctype = r.read(5_000_000), r.headers.get("Content-Type", "")
    if "pdf" in ctype.lower() or raw[:4] == b"%PDF":
        raise ValueError("PDF는 읽지 않습니다. 직접 확인하세요")
    for enc in ("utf-8", "cp949"):
        try:
            html = raw.decode(enc)
            break
        except UnicodeDecodeError:
            html = None
    if html is None:
        html = raw.decode("utf-8", "ignore")
    p = _Text()
    p.feed(html)
    return squash(" ".join(p.parts))


UNIT_RE = re.compile(r"\d[\d,\.]*(?:억|만원|만|원|%|년|개사|개|곳)")


def claims(item):
    """(label, [accepted spellings]) pairs that the page should contain."""
    out, seen = [], set()
    for m in UNIT_RE.findall(str(item.get("benefit", ""))):
        tok = squash(m)
        if tok not in seen:
            seen.add(tok)
            out.append(("금액·수치", [tok]))
    d = deadline_date(item)
    if d:
        y, mo, da = d.year, d.month, d.day
        out.append(("마감일", [f"{y}-{mo:02d}-{da:02d}", f"{y}.{mo:02d}.{da:02d}", f"{y}.{mo}.{da}",
                               f"{y}년{mo}월{da}일", f"{mo}월{da}일"]))
    return out


def cmd_check(args):
    items = [i for i in load(ACTIVE) if i.get("source_url")]
    if args.id is not None:
        items = [i for i in items if i.get("id") == args.id]
    if not items:
        print("source_url이 입력된 항목이 없습니다. data/startup_db.json에 공고 원문 주소를 먼저 넣으세요.")
        return
    for it in items:
        print(f"\n[{it.get('id')}] {it.get('title')}\n  원문: {it['source_url']}")
        try:
            text = fetch_text(it["source_url"])
        except Exception as e:  # network, PDF, HTTP error...
            print(f"  → 읽을 수 없음: {e}")
            continue
        hit = 0
        cl = claims(it)
        for label, variants in cl:
            ok = any(squash(v) in text for v in variants)
            hit += ok
            print(f"  {'✔' if ok else '✗'} {label}: {variants[0]}")
        verdict = "대조 일치" if cl and hit == len(cl) else "일부 불일치" if hit else "일치 항목 없음"
        print(f"  → {verdict} ({hit}/{len(cl)})")
    print("\n※ 자동 대조는 참고용입니다. 불일치는 오류가 아닐 수 있고(PDF·스크립트 페이지), 일치가 정확함의 증명도 아닙니다.")
    print("  원문을 직접 읽은 뒤 data/startup_db.json의 verified_at / verified_note를 직접 적으세요.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("archive").set_defaults(fn=cmd_archive)
    sub.add_parser("validate").set_defaults(fn=cmd_validate)
    c = sub.add_parser("check")
    c.add_argument("--id", type=int)
    c.set_defaults(fn=cmd_check)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
