# JjolJjoli 창업지원사업 DB

정적 사이트(GitHub Pages)입니다. 데이터는 `data/startup_db.json` 한 파일이고, 마감된 사업은 `archive/`로 옮겨집니다.

## 사업 추가·수정
`data/startup_db.json`에 항목을 추가합니다. D-Day는 `deadline`에서 사이트가 계산하므로 적지 않습니다.
`deadline`은 `2026-10-25` 처럼 날짜로 적거나 `상시`로 적습니다.

## 팩트 확인 표시
항목에 아래 세 칸을 채우면 사이트에 `✔ 원문 확인`이 표시됩니다. 비어 있으면 `⚠ 미확인`입니다.
- `source_url`: 공고 원문 주소 (기관 홈페이지가 아니라 해당 공고 페이지)
- `verified_at`: 원문을 직접 읽고 대조한 날짜 `YYYY-MM-DD` (30일이 지나면 `🕒 재확인 필요`)
- `verified_note`: 무엇을 대조했는지 한 줄

## 관리 명령 (Python 3, 설치할 것 없음)
```
python3 scripts/dbtool.py validate        # 형식·출처·재확인 시점 점검
python3 scripts/dbtool.py check [--id N]  # source_url 페이지에서 금액·마감일이 보이는지 자동 대조(참고용)
python3 scripts/dbtool.py archive         # 마감된 사업을 archive/로 이동하고 CSV 갱신
```
`check`는 PDF나 스크립트로 그려지는 페이지를 읽지 못합니다. 결과와 상관없이 `verified_at`은 사람이 직접 적습니다.
