### 실험 등록 플로우
1. 사용자가 프롬프트 작성
   ↓
2. [등록] 버튼 클릭
   ↓
3. Backend API 호출
   ↓
4. MySQL에 저장
   ↓
5. Gemini Embeddings API 호출
   (텍스트 → 벡터 변환)
   ↓
6. Elasticsearch에 인덱싱
   (텍스트 + 벡터 + 메타데이터)
   ↓
7. 성공 응답

### 자연어 검색 플로우
1. 사용자가 "버그를 줄이고 싶어요" 입력
   ↓
2. Backend가 Gemini API 호출
   (검색어 → 벡터 변환)
   ↓
3. Elasticsearch knn 쿼리
   (벡터 유사도 검색)
   ↓
4. 결과 반환 (유사도 점수 포함)
   ↓
5. Frontend에 표시

### 재현 검증 플로우
1. 사용자가 [재현 시도] 클릭
   ↓
2. 프롬프트 복사해서 AI 사용
   ↓
3. 결과 기록 (성공/실패)
   ↓
4. MySQL reproductions 테이블에 저장
   ↓
5. 재현율 재계산
   ↓
6. Elasticsearch 업데이트
   (검색 순위 반영)