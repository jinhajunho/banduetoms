# 매출/매입 테이블 현재 px 값 (지정용 참고)

아래 값들을 바꾸고 싶으면 `src/styles/main.css`에서 해당 클래스를 검색해 수정하면 됩니다.

---

## 테이블 전체

| 항목 | 클래스/선택자 | 속성 | 현재 값 |
|------|----------------|------|--------|
| 테이블 최소 너비 | `.payment-table` | min-width | **720px** |
| 테이블 border-radius | `.payment-table` | border-radius | **10px** |

---

## 헤더(th)

| 항목 | 선택자 | 속성 | 현재 값 |
|------|--------|------|--------|
| 패딩 | `.payment-table th` | padding | **8px 10px** |
| 글자 크기 | `.payment-table th` | font-size | **11px** |
| 첫 열(상호명/업체명) 최소 너비 | `.payment-table th:first-child` | min-width | **180px** |
| 세금 열 (7열 테이블 4번째) | `.payment-table:has(thead th:nth-child(7)) th:nth-child(4)` | min-width / max-width | **40px / 52px** |
| 메모 열 헤더 (7열 6번째) | `.payment-table th:nth-child(6)` | min-width | **180px** |
| 액션 열 | `.payment-table thead tr th.payment-th-action` | width / min-width / max-width / padding | **40px / 40px / 40px / 6px 8px** |

---

## 셀(td)

| 항목 | 선택자 | 속성 | 현재 값 |
|------|--------|------|--------|
| 패딩 | `.payment-table td` | padding | **8px 10px** |
| 글자 크기 | `.payment-table td` | font-size | **12px** |
| 첫 열(상호명/업체명) | `.payment-table td:first-child` | min-width | **180px** |
| 세금 열 (7열 4번째) | `.payment-table:has(thead th:nth-child(7)) td:nth-child(4)` | min-width / max-width | **40px / 52px** |
| 메모 열 (7열 6번째) | `.payment-table:has(thead th:nth-child(7)) td:nth-child(6)` | min-width | **180px** |
| 메모 열 (5열 4번째) | `.payment-table:has(thead th:nth-child(5)) td:nth-child(4)` | min-width | **180px** |
| 액션 셀 | `.payment-table td.payment-action-cell` | width / min-width / max-width / padding | **40px / 40px / 40px / 6px 8px** |

---

## 입력란(input / select)

| 항목 | 선택자 | 속성 | 현재 값 |
|------|--------|------|--------|
| 패딩 | `.payment-table input, .payment-table select` | padding | **5px 8px** |
| border | `.payment-table input, .payment-table select` | border | **1px solid** |
| border-radius | `.payment-table input, .payment-table select` | border-radius | **4px** |
| 글자 크기 | `.payment-table input, .payment-table select` | font-size | **11px** |
| 상호명·메모 input 최소 너비 | `.payment-table td:first-child input`, `td:nth-child(6) input`, `td:nth-child(4) input` | min-width | **100px** |

---

## 섹션(payment-list)

| 항목 | 선택자 | 속성 | 현재 값 |
|------|--------|------|--------|
| 위 여백 | `.payment-list` | margin-top | **16px** |
| 패딩 | `.payment-list` | padding | **14px** |
| border-radius | `.payment-list` | border-radius | **10px** |

---

## ⋮ 메뉴

| 항목 | 선택자 | 속성 | 현재 값 |
|------|--------|------|--------|
| 트리거 버튼 크기 | `.payment-row-menu-trigger` | width / height | **28px / 28px** |
| 트리거 border-radius | `.payment-row-menu-trigger` | border-radius | **6px** |
| 드롭다운 min-width | `.payment-row-menu` | min-width | **88px** |
| 드롭다운 margin-top | `.payment-row-menu` | margin-top | **4px** |
| 드롭다운 border-radius | `.payment-row-menu` | border-radius | **8px** |
| 메뉴 항목 패딩 | `.payment-menu-item` | padding | **8px 12px** |
| 메뉴 항목 글자 크기 | `.payment-menu-item` | font-size | **12px** |

---

## 요약(총액)

| 항목 | 선택자 | 속성 | 현재 값 |
|------|--------|------|--------|
| 위 여백 | `.payment-summary` | margin-top | **16px** |
| 패딩 | `.payment-summary` | padding | **14px 18px** |
| border-radius | `.payment-summary` | border-radius | **8px** |
| 글자 크기 | `.payment-summary` | font-size | **15px** |
| 값 글자 크기 | `.payment-summary-value` | font-size | **16px** |

원하는 숫자로 바꾼 뒤, 위 표의 선택자로 `main.css`에서 찾아 수정하면 됩니다.
