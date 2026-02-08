# PDF 실천계획서 페이지 생성 로직 브리핑

## 1. 전체 구조 (순서)

| 순서 | 내용 | 페이지 |
|------|------|--------|
| 1 | title.png (타이틀 이미지) | 1 |
| 2 | 학교명 (오른쪽 정렬) | 1 |
| 3 | subtitle1.png | 1 |
| 4 | **스크린샷** (탄소배출량 카드, 85% 등) | 1 |
| 5 | subtitle2.png | 1 |
| 6 | **실천 과제 테이블** (4개씩 그룹, 여러 블록 가능) | 1 → 2 → … |

- `currentY`: 현재 그리는 Y 위치(mm). 요소를 그릴 때마다 `currentY += 높이 + 간격` 으로 갱신.
- **페이지 높이**: A4 가로 기준 `pageHeight` (≈ 210mm), 상·하 여백 10mm씩 제외한 **content 영역** 안에서만 그림.

---

## 2. 테이블 그룹화

- `payload.categories` → 모든 항목을 평탄화한 **allTaskItems** (label + details 배열).
- **4개씩** 한 그룹으로 묶음: `tableGroups = [ [item0~3], [item4~7], … ]`
- 그룹이 1개면 테이블 1개, 2개면 테이블 2개, … (마지막 그룹은 4개 미만일 수 있음 → 빈 셀 처리).

---

## 3. 새 페이지가 생기는 세 가지 경우

### 3-1. 첫 번째 테이블(groupIndex === 0)이 현재 페이지에 안 들어갈 때

```ts
if (groupIndex === 0 && currentY + totalTableHeight > pageHeight - PDF_CONFIG.margin.bottom) {
  doc.addPage();
  currentY = PDF_CONFIG.margin.top;
}
```

- **조건**: (현재 Y + 이번 테이블 높이)가 (페이지 높이 − 하단 여백)을 넘으면.
- **동작**: 새 페이지 추가 → 그 새 페이지 **맨 위**에 첫 번째 테이블 전체를 그림.
- **잉여 페이지 가능성**: `totalTableHeight`가 **과대 추정**되면, 실제로는 1페이지에 들어갈 수 있는데도 새 페이지가 만들어질 수 있음.  
  - `row2Height = Math.max(maxDetailHeight, minRow2Height)` (minRow2Height = 18mm)  
  - 빈 셀/짧은 내용도 최소 높이로 잡혀서, “내용보다 크게” 계산될 수 있음.

### 3-2. 두 번째 테이블(groupIndex >= 1)을 그릴 때

```ts
if (groupIndex >= 1 && firstTableEndY != null) {
  if (firstTablePage === 1) {
    doc.addPage(PDF_CONFIG.format, PDF_CONFIG.orientation);  // 무조건 2페이지 추가
    currentY = PDF_CONFIG.margin.top;
  } else {
    doc.setPage(firstTablePage);
    currentY = firstTableEndY + 5;  // 첫 테이블 끝 + 5mm에 두 번째 테이블
  }
}
```

- **firstTablePage === 1** (첫 테이블이 1페이지에만 있음):  
  **무조건 addPage()** → 2페이지를 만들고, 그 위에 두 번째 테이블을 그림.
- **firstTablePage > 1** (첫 테이블이 이미 2페이지 이상으로 넘어감):  
  첫 테이블이 끝난 **같은 페이지**로 이동해서 `firstTableEndY + 5mm` 위치에 두 번째 테이블 그림 (추가 페이지 없음).

→ 그룹이 2개 이상이면, “두 번째 그룹부터는 항상 새 페이지”가 아니라 “첫 테이블이 1페이지에만 있으면 새 페이지, 아니면 그 다음 위치에 이어서” 그리는 구조.

### 3-3. 세부 실천 계획이 “4줄 초과”일 때 (overflow)

- 셀당 **최대 4줄**만 본 테이블에 그림. 나머지는 `item._overflow`에 보관.
- **while (group.some(item => item._overflow?.length))**:
  - 4줄 초과분이 **하나라도** 남아 있으면 → **addPage()** → 새 페이지에 “세부 실천 계획” 한 행짜리 **continuation 테이블**을 그림.
  - 그 테이블에서도 셀당 최대 4줄만 그리며, 다시 남는 줄은 `_overflow`에 넣음.
  - 모든 셀의 `_overflow`가 빈 배열이 될 때까지 반복.

- **잉여 페이지 가능성**:
  - **마지막 continuation**에서: 그릴 줄이 거의 없는데도 `_overflow?.length`가 아직 true여서 한 번 더 addPage() 하고, **거의 빈 테이블**만 그리면 “내용 대비 빈 페이지”처럼 보일 수 있음.
  - 또는 **빈 줄/공백만 있는 줄**이 `splitTextToSize`로 줄 단위로 들어가서, 줄 수만 많아져서 불필요하게 여러 continuation 페이지가 생길 수 있음.

---

## 4. 요약: “쓴 내용보다 더 많은 페이지”가 나올 수 있는 지점

| 원인 | 설명 |
|------|------|
| **1) totalTableHeight 과대 추정** | 빈 셀/짧은 텍스트도 `minRow2Height`(18mm) 등으로 최소 높이를 쓰기 때문에, 실제 그려진 높이보다 “필요 공간”이 크게 잡힘. 그 결과 “한 페이지에 들어갈 수 있는데도” 첫 테이블에서 addPage()가 나올 수 있음. |
| **2) 두 번째 그룹 시 무조건 2페이지** | 그룹이 2개일 때, 첫 테이블이 1페이지에만 있으면 **무조건** addPage()로 2페이지를 만듦. 첫 페이지 아래에 여백이 충분해도 “두 번째 테이블은 항상 새 페이지”로 가서, 1페이지가 많이 비어 보일 수 있음. (설계상 선택) |
| **3) overflow continuation** | 4줄 초과분을 나눠 그릴 때, 마지막에 “한두 줄만 남은” 상태에서도 새 페이지를 열고, 그 페이지에는 작은 테이블만 그리면 “반쯤 빈 페이지”가 됨. 또는 공백/빈 줄이 많으면 continuation 횟수가 불필요하게 늘어남. |

---

## 5. 수정 시 참고 포인트

- **페이지 수를 줄이려면**  
  - 첫 테이블: `totalTableHeight`를 “실제 그리는 높이”에 더 가깝게 계산하거나, “한 페이지에 들어가는지” 판단할 때 여유를 조금만 두기.  
  - overflow: “그릴 줄이 실제로 0줄이면” addPage하지 않기, 또는 “모든 셀의 overflow가 비었으면” while 진입 전에 한 번 더 검사.  
  - 두 번째 테이블: “1페이지 남은 공간(firstTableEndY ~ pageHeight-margin)에 두 번째 테이블이 들어가면” addPage 하지 않고 같은 페이지에 이어 그리기 (현재는 firstTablePage === 1이면 무조건 새 페이지).

- **코드 위치**  
  - `src/app/api/pdf/plan/route.ts`  
    - 테이블 높이: `row2Height`, `totalTableHeight` 계산 부근 (약 461–496줄).  
    - 새 페이지 분기: `groupIndex >= 1` / `groupIndex === 0` 분기 (약 498–514줄).  
    - overflow: `while (group.some(..._overflow?.length))` 및 그 안의 addPage (약 705–767줄).

이 브리핑과 위 포인트를 기준으로, “쓴 내용보다 더 많은 페이지가 생성된다”는 현상을 재현한 뒤, 위 세 가지 중 어떤 조건에서 페이지가 하나 더 나오는지 확인하면 원인을 좁히기 쉽습니다.
