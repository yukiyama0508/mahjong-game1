# Implementation Plan: 麻雀待ち当てタイムアタック (mahjong-machi-quiz-game)

## Overview

設計書(design.md)に従い、TypeScript で実装する。依存の向きは UI → インフラ → ドメインの一方向とする。まずプロジェクトのセットアップを行い、次に純粋関数のドメイン層を実装する。各実装の直後に、対応する Correctness Property のプロパティベーステスト(fast-check)を置く。その後にインフラ層(Clock/Timer、NameStore、RankingClient、AvailabilityTracker、RegistrationController)、UI 層(TileView、6画面、AppController、main.ts)の順に進め、最後に単一 index.html のビルド確認と Supabase の統合テストを行う。

実装言語は TypeScript(design.md で確定済み)。ビルドは Vite + vite-plugin-singlefile、テストは Vitest + fast-check、UI テストは happy-dom を使う。

## Tasks

- [x] 1. プロジェクトのセットアップ
  - [x] 1.1 Vite + TypeScript プロジェクトを初期化する
    - `package.json`、`tsconfig.json`(strict)、`vite.config.ts`(`viteSingleFile()`、`base: './'`、`build.target: 'es2020'`)、`index.html` の雛形を作成する
    - 依存関係を追加する: `vite`、`vite-plugin-singlefile`、`typescript`、`vitest`、`fast-check`、`happy-dom`、`@supabase/supabase-js`
    - `vitest` の設定(環境は既定で node、UI テストでは happy-dom を指定)と `npm test`(`vitest --run`)、`npm run build` のスクリプトを用意する
    - `.env.example` を作成する(`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` のみ。service_role キーは設定しない旨をコメントで記す)。`.gitignore` に `.env` と `node_modules`、`dist` を追加する
    - `src/domain`、`src/infra`、`src/ui`、`tests` のディレクトリ構成を作る
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 1.2 Supabase マイグレーション SQL を作成する
    - `supabase/migrations/0001_init.sql` に、`is_valid_player_name` 関数、`ranking_entries` テーブル(名前規則、点数 0〜1,000,000、`session_id` の長さ、`session_id` の一意制約。名前の一意制約は設けない)、並び順用インデックス、`ranking_view`(`rank()` による順位、`security_invoker = true`)を定義する
    - RLS を有効化し、anon に `ranking_entries` の SELECT と INSERT のみ、`ranking_view` の SELECT のみを付与する。UPDATE と DELETE のポリシーと権限は作らない
    - _Requirements: 9.5, 9.7, 9.14, 10.2, 10.4, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_

- [x] 2. 牌と手牌文字列
  - [x] 2.1 牌の基本型とユーティリティを実装する
    - `src/domain/tile.ts` に `TileId`、`Suit`、`Counts`、`Hand`、`Result<T, E>`、`suitOf`、`numberOf`、`toCounts`、`sortForDisplay`、`tileLabel` を実装する
    - `TileId` の昇順が表示順(萬子、筒子、索子、字牌。字牌は東南西北白發中)になるよう割り当てる
    - _Requirements: 5.1, 5.3_

  - [x]* 2.2 手牌の表示順のプロパティテストを書く
    - **Property 21: 手牌の表示順**
    - **Validates: Requirements 5.1**

  - [x] 2.3 手牌文字列のパーサとシリアライザを実装する
    - `src/domain/hand-parser.ts` に `ParseError`、`parseHand`、`serializeHand` を実装する
    - 同じ種別の複数グループの統合、不正文字・種別文字なしの数字列・数字なしの種別文字・字牌の範囲外・`0` の位置付きエラー、枚数エラー(0枚、15枚以上)、5枚以上の同一牌のエラーを扱う
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x]* 2.4 手牌文字列のラウンドトリップのプロパティテストを書く
    - **Property 1: 手牌文字列のラウンドトリップ**
    - **Validates: Requirements 3.11, 12.6**

  - [x]* 2.5 シリアライザの正準形と parse-print-parse のプロパティテストを書く
    - **Property 2: シリアライザの正準形と parse-print-parse**
    - **Validates: Requirements 12.1, 12.5, 12.7, 12.8**

  - [x]* 2.6 不正な手牌文字列の拒否のプロパティテストを書く
    - **Property 3: 不正な手牌文字列の拒否**
    - **Validates: Requirements 12.2, 12.3, 12.4**

- [ ] 3. 分解の列挙、待ち計算、待ち形分類
  - [ ] 3.1 Interpretation の列挙を実装する
    - `src/domain/interpretation.ts` に `Meld`、`WaitShape`、`Interpretation`、`enumerateInterpretations` を実装する
    - 雀頭候補ごとの再帰分解、整列した面子列での重複除去、和了牌を含む面子ごとの Interpretation 生成、待ち形の判定(両面、カンチャン、ペンチャン、シャボ、単騎)、七対子(`chiitoiTanki`)を扱う。国士無双は対象外とする
    - _Requirements: 2.2, 2.6, 6.10_

  - [ ] 3.2 待ち計算を実装する
    - `src/domain/wait-calculator.ts` に `WaitError`、`calcWaits` を実装する
    - 列挙とは別実装の高速な `isWinning`(早期終了する面子分解と七対子の判定)を使い、4枚持ちの牌種を除外する。13枚でない手と5枚以上の同一牌は `invalidHand` を返す
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.3 待ち集合の並べ替え不変性のプロパティテストを書く
    - **Property 4: 待ち集合の並べ替え不変性**
    - **Validates: Requirements 2.8**

  - [ ]* 3.4 不正な手牌の拒否のプロパティテストを書く
    - **Property 6: 不正な手牌の拒否**
    - **Validates: Requirements 2.7**

  - [ ]* 3.5 待ち集合と Interpretation の存在の同値のプロパティテストを書く
    - **Property 5: 待ち集合と Interpretation の存在の同値**
    - テスト側に素朴な再帰の参照実装を置き、小さな手で `calcWaits` と照合する
    - 九蓮の形で9種類(要件 2.5)、国士無双形で空集合(要件 2.6)の example も含める
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9, 2.10**

  - [ ] 3.6 待ち形分類を実装する
    - `src/domain/wait-classifier.ts` に `WaitType`、`WaitClassification`、`classifyHand` を実装する
    - 待ち牌が3種類以上、または全待ち牌の全 Interpretation の待ち形が2種類以上にまたがる場合は `multi`、それ以外は単一の待ち形を返す
    - _Requirements: 3.3, 3.5_

  - [ ]* 3.7 待ち形分類のプロパティテストを書く
    - **Property 7: 待ち形分類は定義と一致する**
    - **Validates: Requirements 3.3, 3.5**

- [ ] 4. チェックポイント - 牌、待ち計算の確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. 役と点数の計算
  - [ ] 5.1 役判定と役満検出を実装する
    - `src/domain/yaku.ts` に `YakuId`、`YakuEntry`、役の判定、`hasYakuman` を実装する
    - 要件 6.2 の全役(リーチ、平和、断幺九、一盃口、役牌(東・南・白・發・中)、七対子、対々和、三暗刻、三色同順、三色同刻、一気通貫、混全帯幺九、小三元、混老頭、混一色、純全帯幺九、二盃口、清一色)を実装し、排他の組(一盃口と二盃口、混全帯幺九と純全帯幺九など)と七対子形との複合可否を扱う
    - 三暗刻ではロンで完成したシャボの刻子を明刻として数えない
    - 役満(大三元、四暗刻(単騎のみ)、字一色、小四喜、大四喜、清老頭、緑一色、九蓮宝燈)を検出する
    - _Requirements: 6.2, 6.3, 6.7, 3.7, 4.11_

  - [ ] 5.2 符・翻・点数の計算と高点法を実装する
    - `src/domain/score-calculator.ts` に `calcPoints`、`scoreInterpretation`、`scoreWait`、`scoreQuestion` を実装する
    - 符(副底20、門前ロン10、面子符、雀頭符、待ち符を足して10の位に切り上げ。平和は30符、七対子は25符)、基本点、満貫以上の表、子のロン点(100の位に切り上げ。切り上げ満貫なし)を実装する
    - 高点法は点数、翻、符の順で最大のものを選び、同値は形と面子の並びで決定的にする。`questionScore` と `bestWaits` を返す
    - _Requirements: 6.1, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13_

  - [ ]* 5.3 点数計算の決定性と順序非依存のプロパティテストを書く
    - **Property 8: 点数計算の決定性と順序非依存**
    - **Validates: Requirements 6.11, 6.13, 6.14**

  - [ ]* 5.4 点数の構造と範囲のプロパティテストを書く
    - **Property 9: 点数の構造と範囲**
    - **Validates: Requirements 6.3, 6.5, 6.6, 6.15**

  - [ ]* 5.5 高点法と Question_Score の最大性のプロパティテストを書く
    - **Property 10: 高点法と Question_Score の最大性**
    - **Validates: Requirements 6.10, 6.11, 6.12, 6.16**

  - [ ]* 5.6 点数の符・翻に対する単調性のプロパティテストを書く
    - **Property 11: 点数は符と翻について単調**
    - **Validates: Requirements 6.8, 6.17**

  - [ ]* 5.7 点数計算の既知の例の単体テストを書く
    - 要件 6.18 の10例以上(平和2翻30符 = 2000、七対子単騎3翻25符 = 3200、30符4翻 = 7700、60符3翻 = 7700、跳満、倍満、清一色など)を表駆動で検証する
    - 各役の成立例と不成立例、シャボのロン刻子の明刻扱い(符と三暗刻)、満貫以上の基本点と子のロン点(8000、12000、16000、24000、32000)を確認する
    - _Requirements: 6.2, 6.4, 6.7, 6.8, 6.9, 6.18_

- [ ] 6. チェックポイント - 点数計算の確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. 乱数と問題生成
  - [ ] 7.1 乱数を実装する
    - `src/domain/rng.ts` に `Rng`、`createSeededRng`(mulberry32)、`createMathRng` を実装する
    - _Requirements: 3.4_

  - [ ] 7.2 問題生成器を実装する
    - `src/domain/question-generator.ts` に `Question`、`QuestionKind`、`generateQuestion`、`validateNormalQuestion`、`validateChinitsuQuestion`、`NORMAL_FALLBACKS`、`CHINITSU_FALLBACKS` を実装する
    - 7種類の待ち形を等確率で選び、待ち形ごとの雛形(両面、カンチャン、ペンチャン、シャボ、単騎、七対子の単騎、多面待ち)で候補を作り、検証で棄却して最大100回再試行する。失敗時はフォールバック(待ち形ごとに1つ以上の通常問題、5つ以上の清一色問題)を返す
    - 直前の `handKey` と同じ候補は棄却する。清一色問題は1種類の数牌だけで、待ち2種類以上、役満なしを検証する
    - フォールバックの手牌は文字列で定義し、すべて検証を満たすこと
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 4.9, 4.10, 4.11, 4.12_

  - [ ]* 7.3 通常問題の妥当性のプロパティテストを書く
    - **Property 12: 通常問題は妥当である**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.10**

  - [ ]* 7.4 連続する問題の手牌が異なることのプロパティテストを書く
    - **Property 13: 連続する問題の手牌は異なる**
    - **Validates: Requirements 3.8**

  - [ ]* 7.5 清一色問題の妥当性のプロパティテストを書く
    - **Property 14: 清一色問題は妥当である**
    - **Validates: Requirements 4.9, 4.10, 4.11**

  - [ ]* 7.6 問題生成の単体テストを書く
    - 乱数値を `k/7` 付近に固定した7種類の待ち形の選択、全フォールバック手が検証を満たすこと(待ち形ごとに1つ以上、清一色は5つ以上)、常に棄却される条件でフォールバックが返ることを確認する
    - _Requirements: 3.4, 3.9, 4.12_

- [ ] 8. 判定、Streak、セッション、名前検証
  - [ ] 8.1 回答の判定を実装する
    - `src/domain/answer-judge.ts` に `JudgeResult`、`judgeAnswer` を実装する(正解は集合の完全一致。`missing` と `extra` を返す)
    - _Requirements: 7.1, 7.5_

  - [ ]* 8.2 正誤判定のプロパティテストを書く
    - **Property 17: 正誤判定は集合の一致**
    - **Validates: Requirements 7.1, 7.4, 7.5**

  - [ ] 8.3 Streak 管理を実装する
    - `src/domain/streak-manager.ts` に `StreakState`、`initialStreak`、`nextKind`、`onPresented`、`onJudged` を実装する
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.13_

  - [ ]* 8.4 Streak の範囲と遷移のプロパティテストを書く
    - **Property 15: Streak は常に 0〜3 で、遷移規則に従う**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6, 4.13**

  - [ ]* 8.5 出題種別の並びのプロパティテストを書く
    - **Property 16: 出題種別の並び**
    - **Validates: Requirements 4.4, 4.7, 4.8**

  - [ ] 8.6 ゲームセッションの状態遷移を実装する
    - `src/domain/session.ts` に `SESSION_MS`、`AnsweredQuestion`、`SessionState`、`SubmitOutcome`、`startSession`、`submit`、`endSession` を実装する
    - `submit` は、終了後、経過時間30,000ms以上、同一問題の2回目以降、空の回答では `ignored` を返し状態を変えない。判定成立時は点数加算、記録の追記、Streak 更新、次の問題の生成と提示を1回の遷移で行う。`endSession` は未提出の現在問題を破棄する
    - _Requirements: 1.2, 1.8, 1.9, 1.11, 4.5, 5.9, 5.10, 5.11, 5.12, 7.2, 7.3, 7.9, 7.10, 7.11_

  - [ ]* 8.7 セッションの合計点と記録のプロパティテストを書く
    - **Property 18: セッションの合計点と記録**
    - **Validates: Requirements 1.8, 7.2, 7.3, 7.9, 7.11, 8.2, 8.6**

  - [ ]* 8.8 遅延提出、重複提出、セッション外の操作のプロパティテストを書く
    - **Property 19: 遅延提出、重複提出、セッション外の操作は無視される**
    - **Validates: Requirements 1.9, 5.9, 5.10, 5.11, 5.12**

  - [ ] 8.9 名前の検証を実装する
    - `src/domain/name-validator.ts` に `NameError`、`validateName` を実装する(trim は全角スペースを含む。コードポイント数で1〜20、制御文字なし)
    - _Requirements: 9.2, 13.2, 13.3_

  - [ ]* 8.10 名前の検証のプロパティテストを書く
    - **Property 23: 名前の検証**
    - **Validates: Requirements 9.2, 13.2, 13.3**

- [ ] 9. チェックポイント - ドメイン層の確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. インフラ層
  - [ ] 10.1 Clock と Timer を実装する
    - `src/infra/clock.ts` に `Clock` と `performance.now()` による本番実装を、`src/infra/timer.ts` に `Timer` と `remainingSeconds` を実装する
    - 単調時計で経過時間を測り、`setTimeout` と約100ms間隔の更新で終了を通知する。タブ非表示とフィードバック表示中も止めず、`visibilitychange` で経過時間を再確認する
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 10.2 残り時間の表示のプロパティテストを書く
    - **Property 20: 残り時間の表示**
    - **Validates: Requirements 1.4**

  - [ ]* 10.3 Timer の単体テストを書く
    - fake の `Clock` と fake timer で、30秒時点の終了通知、端末時刻の変更に影響されないこと、非表示タブとフィードバック表示中の継続を確認する
    - _Requirements: 1.5, 1.6, 1.7_

  - [ ] 10.4 NameStore を実装する
    - `src/infra/name-store.ts` に `KeyValueStorage`、`NameStore`(`load`、`save`、`persistent`)を実装する
    - キー `machi.player` に JSON(`{"name": string}`)で保存し、文字列そのものと JSON の両方を読む。不正な値や破損した JSON は `null` を返す。ストレージの例外または `null` のストレージではメモリ保持に切り替える
    - _Requirements: 13.4, 13.6, 13.9, 13.12, 13.14, 13.15_

  - [ ]* 10.5 NameStore のラウンドトリップのプロパティテストを書く
    - **Property 24: NameStore のラウンドトリップ**
    - **Validates: Requirements 13.4, 13.12, 13.15**

  - [ ] 10.6 Supabase クライアントと RankingClient を実装する
    - `src/infra/supabase-client.ts`(`createClient` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を渡す)と、`src/infra/ranking-client.ts` に `RankingClient`、`SubmitScoreResult`、`FetchRankingResult`、`RankingEntry`、Supabase 実装、`OfflineRankingClient` を実装する
    - `checkConnection` は `ranking_entries` への `head: true` の SELECT を5秒で打ち切る。`submitScore` は `23505` を `ok`、`23514` を `validation`、その他を `error` に分類し、登録後に `count(total_score > 自分の点数) + 1` で順位を取得する(失敗しても `ok`)。`fetchRanking` は `ranking_view` の上位100件を取得する
    - すべての要求に `AbortController` の5秒タイムアウトを付け、例外を投げず結果の共用体を返す。環境変数が未設定のときは `OfflineRankingClient`(常に `checkConnection` が `false`)を使う
    - _Requirements: 9.3, 9.5, 9.9, 9.11, 9.13, 9.14, 10.1, 10.2, 10.6, 11.5, 15.3_

  - [ ]* 10.7 RankingClient のエラー分類の単体テストを書く
    - fake の Supabase クライアントで、`23505`、`23514`、通信エラー、5秒タイムアウト、不正なレスポンスの分類、`OfflineRankingClient` の挙動を表駆動で確認する
    - _Requirements: 9.11, 9.13, 9.14, 10.6_

  - [ ] 10.8 AvailabilityTracker を実装する
    - `src/infra/availability.ts` に `Availability`、`AvailabilityTracker`(`current`、`refresh`)を実装する。初期値と未完了の状態は `offline` とする
    - _Requirements: 10.13, 10.14, 10.15, 11.7, 11.8, 13.16_

  - [ ] 10.9 RegistrationController を実装する
    - `src/infra/registration.ts` に `RegistrationStatus`、`RegistrationPlan`、`decideRegistration`、`RegistrationController`(`registerSession`、`retry`)を実装する
    - ゲーム終了時に接続確認を行い、成功なら Player_Name、合計点、Session_Id を自動送信する。失敗なら `notApplicable`(リクエストを送らない)にする。同名の既存エントリがあっても登録する。成功した Session_Id には以後再送しない。再試行は同じ名前、点数、Session_Id で再送する。名前は `NameStore` の現在の Player_Name を使う
    - _Requirements: 9.1, 9.3, 9.4, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13, 9.14, 9.15, 9.16, 9.17_

  - [ ]* 10.10 登録の再送制御のプロパティテストを書く
    - **Property 27: セッションごとの登録は成功後に再送されない**
    - **Validates: Requirements 9.10, 9.12, 9.14**

  - [ ]* 10.11 AvailabilityTracker と RegistrationController の単体テストを書く
    - `decideRegistration` の2行(接続成功で `register`、失敗で `skipOffline`)、接続確認の失敗でリクエストが送られないこと、接続確認の成功後の失敗で `failed` になること、スコア0の登録、`refresh` による `current` の更新を確認する
    - _Requirements: 9.4, 9.11, 9.15, 9.17, 10.15, 11.7, 11.8_

- [ ] 11. チェックポイント - インフラ層の確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. UI 層
  - [ ] 12.1 DOM ヘルパーと TileView を実装する
    - `src/ui/dom.ts` に `h()` ヘルパーを実装する。文字列は必ず `textContent` / `createTextNode` で挿入する
    - `src/ui/tile-view.ts` に `renderTile` を実装する。34種類すべてが互いに異なるインライン SVG(数牌は数字と萬・筒・索、字牌は漢字)で、失敗時は `tileLabel` のテキストで代替する
    - _Requirements: 5.2, 5.3, 10.7, 13.7_

  - [ ] 12.2 ログイン、スタート、説明画面を実装する
    - `src/ui/screens/` に Login_Screen(名前入力と確定、パスワード欄なし、検証エラー表示、名前変更時の初期値と「戻る」、`persistent === false` の注意文)、Start_Screen(現在の名前、ゲーム開始、説明、名前変更、ランキング(`availability === 'enabled'` のときのみ))、Explanation_Screen(要件 14.3〜14.8 の内容と戻る)を実装する
    - 名前確定ではサーバーに接続しない。名前は `textContent` で表示する
    - _Requirements: 1.1, 10.13, 10.14, 13.1, 13.2, 13.3, 13.4, 13.5, 13.7, 13.8, 13.9, 13.11, 13.12, 13.13, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9_

  - [ ] 12.3 回答の選択ロジックとゲーム画面を実装する
    - `src/ui/answer-selection.ts` に回答集合の選択切替とクリアの純粋関数を実装する
    - `src/ui/screens/game-screen.ts` に残り秒数と合計点、問題種別表示、13枚の手牌(`sortForDisplay`)、34種の牌パレット(各1回)、クリア、提出、空回答時のメッセージ、フィードバック(○/×と獲得点を700ms表示し、その間も入力を受け付ける)を実装する
    - タイマー更新では秒数と合計点の要素だけを更新する。判定直後に次の問題を表示する。説明画面への入口は置かない。クリックとタッチは `pointerup` で扱う
    - _Requirements: 1.2, 1.4, 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.13, 5.14, 5.15, 7.6, 7.7, 7.8, 11.3, 11.4, 14.10_

  - [ ]* 12.4 回答の選択操作のプロパティテストを書く
    - **Property 22: 回答の選択操作**
    - **Validates: Requirements 5.5, 5.6, 5.8**

  - [ ] 12.5 ゲーム終了画面を実装する
    - `src/ui/screens/result-screen.ts` に合計点、回答数、正解数、解説一覧(手牌、待ち牌、回答、正誤、役、符、翻、Question_Score、獲得点。不正解は獲得点0と正解時の点数、不足と余分の牌(空なら「なし」を明示)、待ちごとの点数が異なる場合は高目の表示)を実装する
    - `RegistrationStatus` を表示する(登録中、完了と順位、登録失敗と再試行、検証エラーの理由、オフライン時の「オフラインのためランキングには登録されません」のみ)。0問の場合の表示、スタートへ戻る、ランキング(有効時のみ)を実装する。名前入力欄と登録ボタンは置かない
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 9.1, 9.8, 9.9, 9.11, 9.13, 9.17, 10.13, 10.14_

  - [ ] 12.6 ランキング画面を実装する
    - `src/ui/screens/ranking-screen.ts` に、開く前の接続確認、`fetchRanking`、順位・名前・点数・登録日の表示、0件の表示、取得失敗時のメッセージと再試行、戻るを実装する
    - `isHighlighted(rowName, playerName)` で名前が現在の Player_Name と一致する全行を強調する。名前は `textContent` で表示する
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.11, 10.12, 10.15_

  - [ ]* 12.7 強調表示の規則のプロパティテストを書く
    - **Property 26: 強調表示の規則**
    - **Validates: Requirements 10.11**

  - [ ] 12.8 AppController を実装する
    - `src/ui/app-controller.ts` に `AppState`、画面遷移、ゲーム開始・終了処理を実装する。名前の有無で Login と Start を切り替える(接続確認を待たずに Start を表示)。Start 表示時とゲーム終了時に `AvailabilityTracker.refresh()` を呼ぶ
    - ゲーム終了時に `endSession` を呼び、`RegistrationController.registerSession` を実行して `lastResult` に保持する。ランキング画面の戻り先(`returnTo`)を保持し、戻っても Result の合計点、解説一覧、`Registration_Status` が変わらないようにする。スタートへ戻る操作でセッションデータを破棄する
    - ログインと名前変更では Supabase に接続しない
    - _Requirements: 1.1, 1.2, 1.3, 1.7, 1.10, 8.9, 8.11, 10.12, 11.5, 11.6, 11.7, 11.8, 13.4, 13.6, 13.9, 13.10, 13.16_

  - [ ] 12.9 エントリポイント、HTML、スタイルを実装する
    - `src/main.ts` で依存(Clock、Rng、NameStore、RankingClient/OfflineRankingClient、AvailabilityTracker、RegistrationController)を組み立てて AppController を起動する
    - `index.html` とスタイルを仕上げる。360px から 1920px で水平スクロールが出ないレイアウト、パレットの牌の 40×40px 以上のタッチターゲット、マウスとタッチの両対応にする
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 15.1, 15.2_

  - [ ]* 12.10 名前のテキスト表示のプロパティテストを書く
    - **Property 25: 名前はテキストとして表示される**
    - happy-dom で、ランキング行、Start 画面の名前、Login 画面の初期値を描画して検証する
    - **Validates: Requirements 10.7, 13.7, 13.8**

  - [ ]* 12.11 画面の単体テストを書く
    - happy-dom で次を確認する: 起動時の画面選択(名前の有無)、Login の検証エラー表示(空、21文字、制御文字)と保存されない場合の注意文、ランキングボタンの表示と非表示(有効、オフライン)、オフライン時にエラーや再試行が出ないこと、Game 画面に説明ボタンがないこと、未提出の問題が解説一覧にないこと、解説一覧の表示項目、0問の結果表示、ログインと名前変更でランキングクライアントの呼び出しが0回であること
    - _Requirements: 1.1, 8.3, 8.4, 8.6, 8.7, 9.17, 10.13, 10.14, 13.1, 13.3, 13.6, 13.12, 14.10_

- [ ] 13. ビルド成果物と統合の確認
  - [ ]* 13.1 ビルド成果物のスモークテストを書く
    - `vite build` の後、`dist/index.html` が外部の `<script src>` と `<link rel="stylesheet">` を持たないことを確認する
    - 環境変数が未設定のビルドで `OfflineRankingClient` が使われ、ゲームが開始できてランキングが無効になることを確認する
    - _Requirements: 15.1, 15.2, 11.6_

  - [ ]* 13.2 Supabase の統合テストを書く
    - ローカルの Supabase に `0001_init.sql` を適用し、anon キーで次を確認する(ローカル Supabase が利用できない環境ではスキップする)
    - 名前規則(前後の空白と全角スペース、21文字、制御文字、空文字の拒否。絵文字を含む20文字の受理)、点数の範囲(-1 と 1,000,001 の拒否、0 と 1,000,000 の受理)、同じ `session_id` の2回目の拒否、同名の複数エントリの保存、並行する登録で欠落がないこと
    - 接続確認用の `head` SELECT の成功、anon の UPDATE と DELETE の拒否、101件以上の投入後の上位100件、点数降順、同点は先着順、同点は同順位であること
    - _Requirements: 9.5, 9.6, 9.7, 9.14, 9.15, 10.2, 10.4, 10.8, 10.9, 10.10, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_

- [ ] 14. 最終チェックポイント
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` 付きのサブタスクは任意で、MVP を急ぐ場合はスキップできる。
- 各タスクは要件番号を参照しており、チェックポイントで段階的に検証する。
- プロパティテストは fast-check を使い、`numRuns` は100以上(待ち計算と点数計算は300以上を推奨)にする。各テストに `// Feature: mahjong-machi-quiz-game, Property {番号}: {名前}` のコメントを付ける。
- 問題生成のテストは `createSeededRng` のシードを使い、失敗時にシードと反例を出力する。
- Supabase の制約、RLS、順位の検証は外部サービスの挙動のため、プロパティではなく統合テスト(13.2)で行う。
- service_role キーはビルド成果物に含めない。`.env` には anon キーのみを設定する。

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "7.1", "8.1", "8.9", "10.1", "10.6"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.6", "3.2", "5.1", "8.2", "8.10", "10.2", "10.3", "10.4", "10.7", "10.8"] },
    { "id": 4, "tasks": ["3.3", "3.4", "3.5", "3.6", "5.2", "10.5"] },
    { "id": 5, "tasks": ["3.7", "5.3", "5.4", "5.5", "5.6", "5.7", "7.2", "10.9"] },
    { "id": 6, "tasks": ["7.3", "7.4", "7.5", "7.6", "8.3", "10.10", "10.11"] },
    { "id": 7, "tasks": ["8.4", "8.5", "8.6"] },
    { "id": 8, "tasks": ["8.7", "8.8"] },
    { "id": 9, "tasks": ["12.1"] },
    { "id": 10, "tasks": ["12.2", "12.3", "12.5", "12.6"] },
    { "id": 11, "tasks": ["12.4", "12.7", "12.8"] },
    { "id": 12, "tasks": ["12.9", "12.10", "12.11"] },
    { "id": 13, "tasks": ["13.1", "13.2"] }
  ]
}
```
