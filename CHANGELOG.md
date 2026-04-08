# 변경 이력 (Change Log)

## 2026-04-08 - 레거시 `estimate.html` 제거
- 프로젝트 관리 진입: `index.html#estimate` — 본문 `public/partials/page-estimate.html`, 로직 `src/js/app.js`
- 루트에 있던 단일 페이지 `estimate.html`(레거시) 삭제 — 실제 앱은 사용하지 않음

## 2026-03-13 - SPA (Single Page Application) 통합 ⭐ **NEW**

### ✅ 완료된 주요 기능

#### 0. HTML 파일 통합 (SPA 아키텍처)
- **목표**: 7개의 개별 HTML 파일을 하나의 index.html로 통합
- **구현 방식**:
  - 각 페이지를 `.page-section` 클래스로 섹션화
  - 좌측 사이드바 메뉴로 페이지 전환
  - JavaScript `showPage()` 함수로 섹션 표시/숨김
  - URL 해시 기반 라우팅 (`#estimate`, `#contractors`, etc.)
  - 브라우저 뒤로가기/앞으로가기 지원 (`hashchange` 이벤트)
- **장점**:
  - ✅ 페이지 새로고침 없이 빠른 전환
  - ✅ 하나의 파일로 통합 관리
  - ✅ 일관된 UI/UX
  - ✅ 상태 유지 (네비게이션 시 데이터 유지)
  - ✅ 모바일 앱과 유사한 사용자 경험

##### 페이지 구성
```
index.html
├─ #estimate (견적서 관리) - 완전 기능
├─ #performance (경영실적관리) - 개발 중
├─ #weekly (주간보고) - 개발 중
├─ #unpaid (미수금) - 개발 중
├─ #contractors (업체정보관리) - 개발 중
├─ #expenses (경비지출관리) - 개발 중
└─ #users (사용자관리) - 개발 중
```

##### 기술적 구현
```javascript
// 페이지 전환 함수
function showPage(pageName) {
  // 모든 섹션 숨기기
  document.querySelectorAll('.page-section').forEach(s => s.style.display = 'none');
  // 선택한 섹션만 표시
  document.getElementById(`page-${pageName}`).style.display = 'block';
  // 메뉴 활성 상태 변경
  // URL 해시 업데이트
}

// 페이지 로드 시 URL 해시 확인
window.addEventListener('DOMContentLoaded', function() {
  const hash = window.location.hash.slice(1);
  showPage(hash || 'estimate'); // 기본: 견적서 관리
});

// 브라우저 뒤로가기/앞으로가기 지원
window.addEventListener('hashchange', function() {
  const hash = window.location.hash.slice(1);
  showPage(hash);
});
```

##### CSS 구조
```css
.page-section {
  display: none; /* 기본 숨김 */
}

.page-section.active {
  display: block; /* 활성 페이지만 표시 */
}
```

##### 네비게이션 메뉴
```html
<a href="#estimate" onclick="showPage('estimate'); return false;">견적서관리</a>
<a href="#contractors" onclick="showPage('contractors'); return false;">업체정보관리</a>
...
```

#### 1. 매출/수금/매입 관리 개선
- **저장/수정/삭제 워크플로우 재설계**
  - 신규 행: [💾 저장] 버튼만 표시
  - 저장된 행: [✏️ 수정] [🗑 삭제] 버튼으로 변경
  - 수정 모드: [💾 저장] [❌ 취소] 버튼
  - 원본 데이터 백업 및 복원 기능
- **확인 다이얼로그 추가**
  - 신규 저장: "입력한 내용을 저장하시겠습니까?"
  - 수정 저장: "수정한 내용을 저장하시겠습니까?"
  - 삭제: "삭제된 데이터는 복구할 수 없습니다"
- **입력 필드 작동 수정**
  - `disabled` → `readOnly` 변경
  - 모든 텍스트 필드 정상 입력 가능
- **메모(비고) 필드 추가**
  - 매출 내역, 수금 내역, 매입 내역, 이체 내역 모두 추가

#### 2. 파일 관리 기능
- **다중 파일 업로드**
  - 세금계산서 여러 개 업로드 가능 (분할 발행 대응)
  - [👁 보기(N)] 버튼으로 파일 개수 표시
- **파일 다운로드 기능**
  - Base64 → Blob 변환
  - 원본 파일명 유지
  - 다운로드 완료 시 시각적 피드백
- **파일 미리보기 모달**
  - z-index: 3000 (최상단 표시)
  - 이미지: 전체화면 확대
  - PDF: iframe으로 표시
  - 파일 목록, 개별 보기/다운로드/삭제

#### 3. 견적서 작성 시스템 (3단계 워크플로우)
- **기본정보 탭에 [📄 견적서 보기/수정] 버튼 추가**
  - 큰 파란색 테두리 버튼
  - 호버 시 배경 변경 효과
- **단계별 네비게이션 UI**
  ```
  ● 1.기본정보 → ○ 2.견적서작성 → ○ 3.미리보기
  ```
  - 활성 단계: 파란색 강조
  - 완료 단계: 녹색 체크 표시
  - 대기 단계: 회색

##### 1단계: 기본 정보
- 등록일, 건물명(*), 공사명(*), 담당자, 구분, 도급사
- 기존 데이터 자동 로드
- 필수 입력 검증
- [다음: 견적서 작성 →]

##### 2단계: 견적서 작성
- 엑셀 스타일 테이블
- 품목명, 수량, 단위, 단가 → 금액 자동 계산
- [+ 품목 추가] / [× 삭제]
- 자동 계산:
  - 공급가액 (품목 합계)
  - 부가세 (10%)
  - 총 금액 (파란색 강조)
- [← 이전] [다음: 미리보기 →]

##### 3단계: 미리보기
- 견적서 양식:
  - 헤더: "견 적 서"
  - 작성일, 공사장소, 공사명, 담당자
  - 품목 테이블 (5컬럼)
  - 공급가액, 부가세, 총 금액
  - 푸터: 반듯한시공
- [← 이전] [📄 인쇄/PDF] [💾 저장]

#### 4. PDF/인쇄 최적화
- **페이지 설정**: A4, 20mm 여백
- **페이지 브레이크 방지**:
  - 품목 행이 페이지 경계에서 안 잘림
  - 특이사항/푸터 안 잘림
  - 품목 테이블과 특이사항 같이 유지
- **품목 개수 무제한**: 5개든 100개든 깨지지 않음

#### 5. UI/UX 개선
- **사이드바 토글**: 우측 경계선 화살표로 접기/펼치기
- **상태 변경**: 테이블에서 상태 배지 클릭 → 드롭다운
- **테이블 행 클릭**: 전체 행 클릭으로 상세 모달
- **취소 기능 제거**: 불필요한 "취소" 체크박스 삭제

#### 6. 버튼 디자인 시스템
| 버튼 | 아이콘 | 색상 | 용도 |
|------|--------|------|------|
| 저장 | 💾 fa-save | 파란색 (primary) | 신규/수정 저장 |
| 수정 | ✏️ fa-edit | 주황색 (warning) | 편집 모드 활성화 |
| 삭제 | 🗑 fa-trash | 빨간색 (danger) | 행 삭제 |
| 취소 | ❌ fa-times | 회색 (gray-500) | 수정 취소 |

### 🔧 기술적 개선
- **readOnly vs disabled**: select는 disabled, input은 readOnly 사용
- **원본 데이터 백업**: `data-original` 속성에 JSON 저장
- **3단계 상태 관리**: 신규 → 저장됨 → 편집 중
- **z-index 계층**: 모달 3000, 파일목록 2000, 패널 1000

### 📋 데이터 구조
```javascript
// 견적서 데이터
{
  code: string,      // 견적코드 (없음, 날짜+건물명+공사명으로 식별)
  date: string,      // 등록일 (YYYY-MM-DD)
  building: string,  // 건물명
  project: string,   // 공사명
  manager: string,   // 담당자
  type: string,      // 세금계산서|사업소득|자체인력
  contractor: string,// 도급사
  revenue: number,   // 매출금액 (총금액)
  ...
}

// 품목 데이터
{
  name: string,      // 품목명
  quantity: number,  // 수량
  unit: string,      // 단위
  price: number,     // 단가
  amount: number     // 금액 (자동 계산)
}
```

### 🎯 핵심 워크플로우

#### 견적서 조회/수정/복사
```
1. 테이블 행 클릭 → 상세 모달
2. [📄 견적서 보기/수정] 클릭
3. 1단계: 날짜 변경 (오늘 날짜 → 복사 효과)
4. 2단계: 품목 수정/추가
5. 3단계: 미리보기 → 인쇄/저장
6. 저장 → 견적서 관리에 추가
```

#### 매출/수금 내역 관리
```
1. 매출정보 탭
2. [+ 매출 추가] → 입력
3. [💾 저장] → 확인 → 저장 완료
4. [✏️ 수정] → 수정 → [💾 저장] or [❌ 취소]
5. [🗑 삭제] → 확인 → 삭제
```

### 📁 수정된 파일
- `index.html` (164KB+) - **NEW** 통합 SPA 메인 페이지
- ~~`estimate.html`~~ — 후일 제거됨 (2026-04-08, `public/partials/page-estimate.html`로 대체)
- `contractors.html` - 레거시, 참고용
- `expenses.html` - 레거시, 참고용
- `performance.html` - 레거시, 참고용
- `weekly.html` - 레거시, 참고용
- `unpaid.html` - 레거시, 참고용
- `users.html` - 레거시, 참고용
- `README.md` - 프로젝트 문서 (SPA 구조 설명 추가)
- `CHANGELOG.md` - 변경 이력 (SPA 통합 기록)

### 🔄 마이그레이션 가이드
```
기존: estimate.html, contractors.html, ...
→ 새로운: index.html (모든 기능 통합)

접근 방법:
- 기존: 각 HTML 파일 개별 열기
- 새로운: index.html 한 번만 열고 메뉴로 이동

URL:
- 기존: estimate.html, contractors.html
- 새로운: index.html#estimate, index.html#contractors
```

### 🚀 다음 개발 권장사항
1. **백엔드 API 연동**: 현재 클라이언트 메모리 → DB 저장
2. **파일 스토리지**: S3/Cloud Storage 연동
3. **품목 라이브러리**: 자주 쓰는 품목 템플릿 저장
4. **견적서 템플릿 커스터마이징**: 회사 로고, 특이사항 수정
5. **견적서 이메일 발송**: PDF 첨부 기능
6. **견적서 승인 워크플로우**: 결재 시스템 연동

---

**마지막 업데이트:** 2026-03-13  
**버전:** 2.0.0 - SPA 통합 버전  
**주요 변경사항:**  
- ✅ 7개의 HTML 파일을 index.html로 통합  
- ✅ SPA (Single Page Application) 아키텍처 적용  
- ✅ 페이지 새로고침 없이 빠른 네비게이션  
- ✅ URL 해시 기반 라우팅 (#estimate, #contractors, etc.)  
- ✅ 브라우저 뒤로가기/앞으로가기 지원
