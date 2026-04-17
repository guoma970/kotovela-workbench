# DEV-20260416-43 Stabilization Test

- run_id: stab-1776444588982
- total: 31
- pass: 26
- fail: 5
- failed_modules: content, business, boundary

## Test Results

| case_id | module | result | note |
| --- | --- | --- | --- |
| SCH-01 | scheduler | pass | decision_log present |
| SCH-02 | scheduler | pass | decision_log present |
| SCH-03 | scheduler | pass | decision_log present |
| SCH-04 | scheduler | pass | decision_log present |
| SCH-05 | scheduler | pass | decision_log present |
| SCH-06 | scheduler | pass |  |
| SCH-07 | scheduler | pass |  |
| SCH-08 | scheduler | pass |  |
| SCH-09 | scheduler | pass |  |
| SCH-10 | scheduler | pass | decision_log present |
| SCH-11 | scheduler | pass |  |
| CNT-01 | content | pass |  |
| CNT-02 | content | pass |  |
| CNT-03 | content | pass | invalid accounts filtered |
| CNT-04 | content | fail | boundary conflict |
| CNT-05 | content | pass |  |
| CNT-06 | content | pass |  |
| CNT-07 | content | pass |  |
| CNT-08 | content | pass |  |
| BIZ-01 | business | fail | lead_id / consultant fields absent in payload |
| BIZ-02 | business | pass |  |
| BIZ-03 | business | pass |  |
| BIZ-04 | business | fail |  |
| DAT-01 | consistency | pass |  |
| DAT-02 | consistency | pass |  |
| DAT-03 | consistency | pass |  |
| DAT-04 | consistency | pass |  |
| BDY-01 | boundary | pass |  |
| BDY-02 | boundary | fail |  |
| BDY-03 | boundary | pass |  |
| BDY-04 | boundary | fail |  |

## Defects

| id | severity | reproducible | suggestion |
| --- | --- | --- | --- |
| DEF-01 | P0 | yes | 补齐 leads / lead-stats / consultant funnel 数据模型与 API，至少在 tasks-board 中回写 lead_id、consultant_id、converted/lost。 |
| DEF-02 | P1 | yes | 调整 content_line 冲突优先级，对含“地暖/采暖”场景优先命中 floor_heating，避免被 material_case 抢占。 |

## Required Screenshots

- system-test-summary.png
- test-case-table.png
- defect-list.png