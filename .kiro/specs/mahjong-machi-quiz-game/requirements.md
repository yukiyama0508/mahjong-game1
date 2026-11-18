# Requirements Document

## Introduction

麻雀待ち当てタイムアタック(Machi Quiz Game)は、13枚のテンパイ手牌を提示し、プレイヤーが待ち牌をすべて当てる Web ゲームである。ゲームは30秒間のタイムアタックで、制限時間内にできるだけ多くの問題へ回答し、正解した問題の麻雀の点数(符・翻に基づく子のロン和了点)の合計を競う。ゲーム終了後に全回答の解説一覧と合計スコアを表示し、Supabase に接続できる場合は、ログイン名と合計スコアが共有ランキングへ自動登録される。Supabase に接続できない場合はランキング機能を無効とし、ゲームのプレイと解説一覧の表示のみを通常どおり提供する。

### 画面構成と遷移

本ゲームは次の6画面で構成される。

1. ログイン画面(Login_Screen): 名前のみを入力する。パスワードやアカウントは存在しない
2. ゲームスタート画面(Start_Screen): ゲーム開始、説明画面、ランキング画面(ランキング機能が有効な場合のみ)、名前変更への入口
3. 説明画面(Explanation_Screen): ゲームのルールと点数計算の前提を掲載する
4. ゲーム画面(Game_Screen): 30秒のタイムアタック中に Question と回答入力を表示する
5. ゲーム終了画面(Result_Screen): 合計点、正解/不正解数、各問題の解説一覧、自動登録の結果を表示する
6. ランキング画面(Ranking_Screen): ランキングを表示する

画面遷移は次のとおりとする。

- 起動時: 名前がブラウザに保存されていない場合は Login_Screen、保存されている場合は Start_Screen
- Login_Screen → Start_Screen(名前の確定。クライアント側の名前ルールに合格した名前をブラウザに保存して遷移する。サーバーとの通信は行わない。名前ルールに違反する場合は Login_Screen に留まる)
- Start_Screen → Login_Screen(名前変更)、Explanation_Screen、Game_Screen(ゲーム開始)、Ranking_Screen(ランキング機能が有効な場合のみ)
- Explanation_Screen → Start_Screen(戻る)
- Game_Screen → Result_Screen(30秒経過によるゲーム終了)
- Result_Screen → Start_Screen(スタートへ戻る)、Ranking_Screen(ランキング機能が有効な場合のみ)
- Ranking_Screen → 直前の画面(Start_Screen または Result_Screen)

### 前提条件(Assumptions)

- A1. 対象ルールは日本リーチ麻雀で、牌は萬子・筒子・索子の数牌(1〜9)と字牌7種の計34種類(各4枚)とする。赤牌は使用しない。
- A2. 和了の条件は常に「子・ロン和了・門前・リーチ付き」とする。ツモ、親、副露、槓は扱わない。
- A3. ドラ、裏ドラ、赤ドラ、一発は存在しない(翻数に加算しない)。
- A4. 場風は東、自風は南(南家)で固定する。したがって東と南は役牌(各1翻)、白・發・中も役牌(各1翻)であり、西・北は役牌ではない。
- A5. 和了形は4面子1雀頭と七対子のみとする。国士無双は対象外とする。
- A6. 役満に該当する手牌は出題しない(役満役を含む手牌は出題対象外)。
- A7. 点数は子のロン点数表に従い、切り上げ満貫は採用しない(例: 30符4翻は7,700点、60符3翻は7,700点)。
- A8. ロンで完成した刻子(シャンポン待ちの当たり牌による刻子)は明刻として符計算する。
- A9. 連続正解カウントが3に達した直後の問題は清一色問題とする。清一色問題の出題時に連続正解カウントを0に戻し、清一色問題自体の結果は連続正解カウントに加算しない。
- A10. アプリケーションの利用者は社内など限定された範囲に制限される。アクセス制限はネットワークまたはホスティング側の設定で行う。アプリケーションのログインは名前のみの簡易ログインであり、パスワードやアカウントを持たず、認証は行わない。名前は一意ではなく、同じ名前を複数の利用者が使用できる。このためランキング上で同名の利用者を区別できないが、この制約は許容する。名前の検証はクライアント側の名前ルール(trim 後 1〜20コードポイント、制御文字なし)のみで行い、ログイン時にサーバーへの名前登録や存在確認は行わない。名前はブラウザ(localStorage)に保存するだけである。
- A11, A12. 欠番(名前の一意性を廃止したため)。名前を変更した場合、既存の Ranking_Entry は変更前の名前のまま残り、変更後のランキング登録は新しい名前で行う。
- A13. データの保存範囲は次のとおりとする。サーバー(Supabase)には Ranking_Entry(名前、合計点、登録日時、二重登録防止用のセッションID)のみを保存する。ブラウザには名前のみを保存する。問題ごとの解説データ(手牌、待ち牌、回答、役・符・翻など)は保存せず、ゲーム終了画面の表示中のみメモリ上に保持する。
- A14. 技術制約: アプリケーションは TypeScript で開発する。ビルド成果物は JavaScript と CSS をインライン化した単一の index.html(例: Vite + vite-plugin-singlefile)とし、静的ホスティングまたはファイル配置で動作する。専用のアプリケーションサーバーは持たない。サーバー側のデータ保存には Supabase を使い、ブラウザから supabase-js で直接接続する。Supabase の利用はランキング関連(Ranking_Entry の登録と取得、Connection_Check)のみとする。本書の Ranking_Server は Supabase(テーブル、テーブル制約、RLS)を指す。
- A15. 不正対策の範囲: Supabase の anon キーは index.html に含まれ公開される。点数の改ざん、なりすまし、クライアントの改変は許容する(社内限定利用のため)。最低限の対策として、Supabase の RLS とテーブル制約により次をサーバー側で強制する: anon ロールは Ranking_Entry に対して INSERT と SELECT のみ可能(UPDATE と DELETE は不可)、名前ルール(trim 後 1〜20コードポイント、制御文字不可)、合計点は 0〜1,000,000 の整数、Session_Id の一意性。名前の一意性は強制しない。
- A16. オフライン扱い: 起動時およびランキング関連の操作の前に、Supabase への接続可否を確認する(Connection_Check)。接続できない場合はランキング機能を無効とし、ランキング画面への操作を表示せず、ゲーム終了時のランキング自動登録も行わない。この場合はエラーメッセージや再試行ボタンを表示せず、ゲーム終了画面に「オフラインのためランキングには登録されません」という控えめな表示のみを行う。ゲームのプレイと解説一覧は通常どおり動作する。失敗メッセージと再試行ボタンは、Connection_Check が成功したにもかかわらず個別のリクエスト(ランキング登録、ランキング取得)が失敗した場合に限り表示する。ログインと名前変更は Supabase を使わないため、接続状態に影響されない。
- A17. 欠番(未確認の名前の概念を廃止したため)。

## Glossary

- **Game**: 30秒タイムアタックのセッション全体(開始から終了まで)を管理するシステム
- **Question_Generator**: 問題(13枚の手牌)を生成するコンポーネント
- **Wait_Calculator**: 手牌から待ち牌の集合を算出するコンポーネント
- **Wait_Classifier**: 手牌の待ち形(Wait_Type)を分類するコンポーネント
- **Score_Calculator**: 手牌と和了牌から役・符・翻・点数を算出するコンポーネント
- **Answer_Judge**: プレイヤーの回答を正解の待ち牌集合と照合するコンポーネント
- **Streak_Manager**: 連続正解カウントと清一色問題の出題判定を管理するコンポーネント
- **Timer**: 30秒の制限時間を計測するコンポーネント
- **UI**: 手牌、回答入力、フィードバック、結果、ランキングを表示するブラウザ上のユーザーインターフェース
- **Login_Screen**: 名前のみを入力する画面
- **Start_Screen**: ゲームスタート画面
- **Explanation_Screen**: ゲームのルールを説明する画面
- **Game_Screen**: ゲーム進行中の画面
- **Result_Screen**: ゲーム終了画面
- **Ranking_Screen**: ランキング画面
- **Player_Name**: ログイン時に入力された、trim 後の名前。ランキング登録とランキング画面での強調表示に使用する
- **Name_Store**: Player_Name をブラウザの localStorage に保存・読み出しするコンポーネント。localStorage が利用できない場合はメモリ上に保持する
- **Connection_Check**: Ranking_Server へ接続できるかどうかを確認する操作。5秒以内に Ranking_Server から正常な応答を受け取った場合に成功、それ以外を失敗とする
- **Ranking_Availability**: 直近の Connection_Check の結果に基づくランキング機能の状態。成功した場合は有効、失敗した場合または Connection_Check が未完了の場合はオフライン
- **Registration_Status**: 自動登録の状態(登録中、登録完了、登録失敗、登録対象外)。登録対象外は、オフラインのため登録リクエストを送信しない状態を指す
- **Ranking_Server**: Supabase(テーブル、テーブル制約、RLS)。Ranking_Entry を保存し、ランキングの登録と提供を行う。専用のアプリケーションサーバーは存在しない(A14)
- **Ranking_Client**: UI 側で supabase-js を用いて Ranking_Server と直接通信するコンポーネント
- **Hand_Parser**: 手牌文字列(例: 123m456p789s1122z)を Hand に変換するコンポーネント
- **Hand_Serializer**: Hand を手牌文字列に変換するコンポーネント
- **Tile**: 麻雀牌。萬子(1〜9)、筒子(1〜9)、索子(1〜9)、字牌(東・南・西・北・白・發・中)の34種類
- **Hand**: 13枚の Tile からなる手牌
- **Tenpai_Hand**: 1種類以上の Wait_Tile を持つ Hand
- **Wait_Tile**: Hand に加えると Winning_Pattern が完成する Tile の種類(待ち牌)
- **Winning_Pattern**: 和了形。4面子1雀頭または七対子
- **Interpretation**: 14枚の和了手牌に対する1通りの分解(面子・雀頭の組み合わせ、または七対子)と、和了牌がどの位置として扱われるかの組み合わせ
- **Wait_Type**: 待ち形。両面、カンチャン、ペンチャン、シャボ、単騎、七対子の単騎、多面待ちの7種類。多面待ちとは、Wait_Tile が3種類以上である待ち(例: 三面張 1-4-7m、延べ単)、または Interpretation によって待ち形が複数種類にまたがる複合した待ち(例: 両面とシャボの複合)をいう。多面待ち以外の6種類は、全 Wait_Tile の全 Interpretation の待ち形が当該1種類のみである待ちをいう
- **Normal_Question**: 待ち形(Wait_Type)7種類のいずれかを対象とする通常問題。多面待ちの Normal_Question は清一色ではない手牌(2色以上の数牌、または字牌を含む手牌)とする
- **Chinitsu_Question**: 清一色の多面待ち問題(Wait_Tile が2種類以上、高難度)
- **Question**: Normal_Question または Chinitsu_Question
- **Answer**: プレイヤーが選択した Tile 種類の集合
- **Yaku**: 役。本書の Requirement 6 で定義する対象役
- **Fu**: 符。**Han**: 翻
- **Question_Score**: ある Question に正解した場合に得られる点数(Wait_Tile のうち最高の点数)
- **Streak**: 連続正解カウント
- **Total_Score**: 正解した Question の獲得点の合計
- **Answered_Question**: 制限時間内にプレイヤーが提出し、採点された Question
- **Discarded_Question**: 制限時間終了時に未提出だった Question(無効)
- **Feedback**: 回答直後に短時間表示する○/×と獲得点
- **Review_List**: ゲーム終了後に表示する全 Answered_Question の解説一覧
- **Ranking_Entry**: ランキングの1件(順位、名前、スコア、登録日時)。サーバーには名前、合計点、登録日時、二重登録防止用のセッションIDを保存する
- **Session_Id**: ゲームセッションごとに Game が生成する識別子。同一セッションの二重登録防止に使用する

## Requirements

### Requirement 1: ゲームの開始と時間管理

**User Story:** As a プレイヤー, I want 30秒のタイムアタックを開始したい, so that 短時間で手軽に遊べる

#### Acceptance Criteria

1. WHEN the application is launched and a Player_Name is held by the Name_Store, THE UI SHALL display the Start_Screen containing the start control, the explanation control, the name change control, and the current Player_Name within 2 seconds of launch completing, without waiting for the result of the Connection_Check (the ranking view control is governed by Requirement 10 criterion 13)
2. WHEN the player activates the start control, THE Game SHALL start a new game session with Total_Score 0, Streak 0, and 0 Answered_Questions, and THE UI SHALL display the first Question within 1 second
3. WHEN the first Question is displayed, THE Timer SHALL start counting down from 30 seconds
4. WHILE a game session is in progress, THE UI SHALL display the remaining time in whole seconds (rounded up, from 30 to 1) and the current Total_Score
5. THE Timer SHALL measure elapsed time with a monotonic clock so that the remaining time is unaffected by changes to the device clock
6. WHILE the browser tab is hidden or the Feedback is displayed, THE Timer SHALL continue counting down without pausing
7. WHEN the elapsed time reaches 30 seconds, THE Game SHALL end the game session and THE Timer SHALL report the end within 100 ms of the 30-second point
8. WHEN the game session ends while a Question is displayed and not yet submitted, THE Game SHALL treat the Question as a Discarded_Question, SHALL NOT judge it, SHALL NOT add it to the Total_Score or the Streak, and SHALL exclude it from the Review_List
9. IF the player activates the submit control after the elapsed time has reached 30 seconds, THEN THE Game SHALL ignore the submission and treat the Question as a Discarded_Question
10. WHEN the game session ends, THE UI SHALL display the result screen within 1 second
11. THE Game SHALL NOT provide a Difficulty selection and SHALL present only Normal_Questions and Chinitsu_Questions

### Requirement 2: 待ち牌の算出

**User Story:** As a プレイヤー, I want 正確な待ち牌が正解として扱われる, so that 学習内容が麻雀のルールと一致する

#### Acceptance Criteria

1. WHEN a Hand of exactly 13 Tiles is provided, THE Wait_Calculator SHALL return the set of all Tile types (out of the 34 types) that complete a Winning_Pattern when one Tile of that type is added to the Hand, within 100 ms
2. THE Wait_Calculator SHALL recognize 4面子1雀頭 and 七対子 as the only Winning_Patterns
3. IF a Tile type is already held 4 times in the Hand, THEN THE Wait_Calculator SHALL exclude that Tile type from the Wait_Tile set
4. WHEN a Hand of 13 Tiles has no Tile type that completes a Winning_Pattern, THE Wait_Calculator SHALL return an empty set
5. WHEN a Hand such as 1m1m1m2m3m4m5m6m7m8m9m9m9m (thirteen Tiles of the 清一色 nine-sided shape) is provided, THE Wait_Calculator SHALL return all 9 Tile types 1m through 9m
6. WHEN a Hand consists of 国士無双 shape (for example 1m9m1p9p1s9s1z2z3z4z5z6z7z), THE Wait_Calculator SHALL NOT treat 国士無双 as a Winning_Pattern and SHALL return an empty set
7. IF the provided Hand does not contain exactly 13 Tiles, or contains more than 4 Tiles of the same Tile type, THEN THE Wait_Calculator SHALL reject the input with an error indicating the invalid Hand and SHALL NOT return a Wait_Tile set
8. FOR ALL Hands, THE Wait_Calculator SHALL return the same Wait_Tile set for every permutation of the Tiles in the Hand (order-independence property)
9. FOR ALL Tenpai_Hands and each Wait_Tile in the returned set, adding the Wait_Tile to the Hand SHALL produce a 14-Tile Hand that has at least one Interpretation (soundness property)
10. FOR ALL Hands and each Tile type not in the returned Wait_Tile set, adding that Tile type to the Hand SHALL produce a 14-Tile Hand that has no Interpretation or has more than 4 Tiles of that type (completeness property)

### Requirement 3: 通常問題の出題

**User Story:** As a プレイヤー, I want 両面・カンチャン・シャボ・多面待ちなど、さまざまな待ちの形の問題が出題される, so that いろいろな待ちの形を見抜く練習ができる

#### Acceptance Criteria

1. WHEN a Normal_Question is required, THE Question_Generator SHALL generate a Tenpai_Hand of exactly 13 Tiles within 1 second
2. THE Question_Generator SHALL generate each Hand such that no Tile type appears more than 4 times
3. WHEN the target Wait_Type of a Normal_Question is one of 両面, カンチャン, ペンチャン, シャボ, 単騎, or 七対子の単騎, THE Question_Generator SHALL generate the Hand such that the set of Wait_Types over all Interpretations of all Wait_Tiles of the Hand contains exactly 1 Wait_Type, namely the target Wait_Type
4. WHEN a Normal_Question is required, THE Question_Generator SHALL select the target Wait_Type with equal probability from the 7 Wait_Types (両面, カンチャン, ペンチャン, シャボ, 単騎, 七対子の単騎, 多面待ち)
5. THE Question_Generator SHALL generate each Normal_Question such that the Wait_Calculator returns 1 Wait_Tile for カンチャン, ペンチャン, 単騎, and 七対子の単騎, 2 Wait_Tiles for 両面 and シャボ, and 2 or more Wait_Tiles for 多面待ち, where a 多面待ち Hand has either 3 or more Wait_Tiles or a composite of 2 or more Wait_Types across the Interpretations of its Wait_Tiles
6. THE Question_Generator SHALL generate each Normal_Question such that the Score_Calculator finds at least 1 Yaku for every Wait_Tile (リーチ guarantees at least 1 Han)
7. THE Question_Generator SHALL NOT generate a Hand for which any Interpretation of any Wait_Tile contains a 役満 Yaku (assumption A6)
8. WHEN a Question is required and more than one candidate Hand exists, THE Question_Generator SHALL generate a Hand whose serialized string differs from that of the immediately preceding Question
9. IF the Question_Generator fails to generate a Normal_Question satisfying criteria 1 to 7 within 100 attempts, THEN THE Question_Generator SHALL return a Hand from a predefined fallback set that contains at least 1 Hand per Wait_Type, and each Hand in the fallback set SHALL satisfy criteria 1 to 7
10. WHERE the target Wait_Type of a Normal_Question is 多面待ち, THE Question_Generator SHALL generate a Hand that contains Tiles of 2 or more suits or at least 1 字牌, so that the Hand is not a 清一色 Hand
11. WHEN the Hand_Serializer is applied to a generated Normal_Question and the result is parsed by the Hand_Parser, THE Hand_Parser SHALL produce a Hand equivalent to the generated Hand

### Requirement 4: 清一色問題の出題と連続正解

**User Story:** As a プレイヤー, I want 連続正解すると高難度の清一色問題に挑戦したい, so that 腕前に応じた高得点を狙える

#### Acceptance Criteria

1. THE Streak_Manager SHALL start each game session with Streak 0
2. WHEN a Normal_Question is judged correct, THE Streak_Manager SHALL increment the Streak by 1
3. WHEN a Question is judged incorrect, THE Streak_Manager SHALL reset the Streak to 0
4. WHEN the Streak becomes 3, THE Game SHALL make the next Question a Chinitsu_Question
5. WHEN a Chinitsu_Question is presented, THE Streak_Manager SHALL reset the Streak to 0 at the time of presentation, regardless of the later result of that Chinitsu_Question
6. WHEN a Chinitsu_Question is judged, THE Streak_Manager SHALL keep the Streak at 0 regardless of the result
7. WHILE the Streak is less than 3, THE Game SHALL present a Normal_Question as the next Question, except when criterion 4 applies
8. WHEN 3 consecutive Normal_Questions are judged correct after the Chinitsu_Question (or after the start of the session), THE Game SHALL present the next Chinitsu_Question
9. THE Question_Generator SHALL generate each Chinitsu_Question as a 13-Tile Tenpai_Hand consisting of Tiles of exactly 1 suit among 萬子, 筒子, and 索子 with no 字牌
10. THE Question_Generator SHALL generate each Chinitsu_Question such that the Wait_Calculator returns 2 or more Wait_Tiles and every Wait_Tile completes a hand containing the 清一色 Yaku
11. THE Question_Generator SHALL generate each Chinitsu_Question such that no Interpretation of any Wait_Tile contains a 役満 Yaku (including 九蓮宝燈 and 四暗刻)
12. THE Question_Generator SHALL generate each Chinitsu_Question within 1 second, and IF the Question_Generator fails within 100 attempts, THEN THE Question_Generator SHALL return a Hand from a predefined fallback set of at least 5 Chinitsu_Question Hands that satisfy criteria 9 to 11
13. FOR ALL sequences of judged results, THE Streak SHALL remain an integer between 0 and 3 inclusive (invariant)

### Requirement 5: 回答の入力

**User Story:** As a プレイヤー, I want 待ち牌を選んで素早く回答したい, so that 制限時間内に多くの問題に答えられる

#### Acceptance Criteria

1. WHEN a Question is displayed, THE UI SHALL display the 13 Tiles of the Hand sorted in the order 萬子, 筒子, 索子, 字牌, with ascending number (1 to 9) within each suit and 字牌 ordered 東, 南, 西, 北, 白, 發, 中
2. THE UI SHALL render each of the 34 Tile types with an image or glyph that differs from that of every other Tile type
3. IF a Tile image or glyph fails to load, THEN THE UI SHALL display a text label naming the suit and number (or the 字牌 name) of that Tile in its place and SHALL keep the sort order unchanged
4. WHILE a game session is in progress, THE UI SHALL display a selectable palette of exactly 34 Tile types, with each Tile type shown exactly once, and an indication whether the current Question is a Normal_Question or a Chinitsu_Question
5. WHEN the player selects an unselected Tile type in the palette, THE UI SHALL add the Tile type to the Answer and display it as selected within 100 ms
6. WHEN the player selects an already selected Tile type in the palette, THE UI SHALL remove the Tile type from the Answer and display it as unselected within 100 ms
7. WHEN a new Question is displayed, THE UI SHALL display the Answer as empty with all 34 Tile types unselected
8. WHEN the player activates the clear control, THE UI SHALL empty the Answer and keep the Question displayed
9. WHEN the player activates the submit control while the Answer contains between 1 and 34 Tile types and the elapsed time is less than 30 seconds, THE Game SHALL pass the Answer to the Answer_Judge exactly once per activation
10. IF the player activates the submit control while the Answer is empty, THEN THE UI SHALL display a message indicating that at least 1 Tile type must be selected, SHALL NOT pass the Answer to the Answer_Judge, and SHALL keep the same Question displayed
11. IF the player activates the submit control more than once for the same Question, THEN THE Game SHALL judge only the first activation and ignore the others
12. IF the game session is not in progress, THEN THE UI SHALL ignore selection, clear, and submit activations and leave the Answer unchanged
13. WHEN a Question has more than one Wait_Tile (including 多面待ち, 両面, シャボ, and Chinitsu_Question), THE UI SHALL require the player to select every correct Tile type in the palette and then activate the submit control to submit the Answer
14. WHEN the player selects or deselects a Tile type in the palette, THE Game SHALL NOT submit or judge the Answer, and THE Game SHALL submit and judge the Answer only when the player activates the submit control
15. WHEN the Game has judged a submitted Answer, THE UI SHALL display the next Question immediately according to Requirement 7

### Requirement 6: 点数計算

**User Story:** As a プレイヤー, I want 実際の麻雀の点数が得点になってほしい, so that 麻雀の点数感覚も身につく

#### Acceptance Criteria

1. THE Score_Calculator SHALL calculate points for a 14-Tile winning hand under the conditions of assumptions A2 to A8 (子・ロン・門前・リーチ・ドラなし・東場南家)
2. THE Score_Calculator SHALL support the following Yaku and Han values (menzen): リーチ 1, 平和 1, 断幺九 1, 一盃口 1, 役牌 1 per triplet (東, 南, 白, 發, 中), 七対子 2, 対々和 2, 三暗刻 2, 三色同順 2, 三色同刻 2, 一気通貫 2, 混全帯幺九 2, 小三元 2 (plus 役牌 Han of its triplets), 混老頭 2, 混一色 3, 純全帯幺九 3, 二盃口 3, 清一色 6
3. THE Score_Calculator SHALL always include リーチ (1 Han) in every calculation
4. WHEN the Interpretation is 4面子1雀頭, THE Score_Calculator SHALL calculate Fu as: 副底 20, plus 10 for 門前ロン, plus 面子 Fu (暗刻 of 中張牌 4, 暗刻 of 幺九牌 8, 明刻 of 中張牌 2, 明刻 of 幺九牌 4), plus 雀頭 Fu (役牌 2, otherwise 0), plus 待ち Fu (カンチャン 2, ペンチャン 2, 単騎 2, 両面 0, シャボ 0), then round the total up to the next multiple of 10
5. WHEN the Interpretation is 4面子1雀頭 with 平和 (all 順子, 役牌でない雀頭, 両面待ち), THE Score_Calculator SHALL set Fu to 30 and apply the 平和 Yaku
6. WHEN the Interpretation is 七対子, THE Score_Calculator SHALL set Fu to 25 without rounding
7. WHEN the Wait_Tile completes a シャボ待ち triplet by ron, THE Score_Calculator SHALL treat that triplet as 明刻 for Fu calculation and for 三暗刻 judgment
8. THE Score_Calculator SHALL calculate the base points as Fu × 2^(Han + 2) and cap it as follows: Han 5 or base points above 2000 → 2000 (満貫); Han 6 or 7 → 3000 (跳満); Han 8 to 10 → 4000 (倍満); Han 11 or 12 → 6000 (三倍満); Han 13 or more → 8000 (数え役満)
9. THE Score_Calculator SHALL calculate the ron points of a 子 as base points × 4 rounded up to the next multiple of 100, which yields 8000 for 満貫, 12000 for 跳満, 16000 for 倍満, 24000 for 三倍満, and 32000 for 数え役満
10. WHEN a Wait_Tile has more than one Interpretation, THE Score_Calculator SHALL select the Interpretation with the highest points (高点法), including the case in which both a 4面子1雀頭 Interpretation and a 七対子 Interpretation exist for the same Wait_Tile
11. IF multiple Interpretations have equal highest points, THEN THE Score_Calculator SHALL select the one with the higher Han, and IF still equal, the one with the higher Fu, so that the result is deterministic
12. WHEN a Question has more than one Wait_Tile and the points differ among the Wait_Tiles (高目・安目), THE Score_Calculator SHALL define the Question_Score as the highest points among the Wait_Tiles
13. THE Score_Calculator SHALL return, for each Wait_Tile, the selected Interpretation's Yaku list, Fu, Han, and points
14. FOR ALL Hands and Wait_Tiles, THE Score_Calculator SHALL return identical Yaku, Fu, Han, and points when called repeatedly with the same inputs and for every permutation of the Hand Tiles (determinism and order-independence property)
15. FOR ALL Wait_Tiles, THE points returned by the Score_Calculator SHALL be a multiple of 100 and SHALL be at least 1000 and at most 32000 (range invariant)
16. FOR ALL Wait_Tiles, THE points returned by the Score_Calculator SHALL be greater than or equal to the points of every individual Interpretation of that Wait_Tile (maximality property)
17. FOR ALL Hands and Wait_Tiles, THE points returned by the Score_Calculator SHALL be greater than or equal to the points obtained when any single Yaku other than リーチ is removed from the same Interpretation's Yaku list with Fu unchanged (monotonicity in Han property)
18. WHEN the Score_Calculator is given any of at least 10 example Hand/Wait_Tile pairs with known expected values (covering 平和 2 Han 30 Fu = 2000, 七対子単騎 3 Han 25 Fu = 3200, 30符4翻 = 7700, 60符3翻 = 7700, 跳満, 倍満, and 清一色), THE Score_Calculator SHALL return the expected Yaku, Fu, Han, and points for each example

### Requirement 7: 正誤判定と進行

**User Story:** As a プレイヤー, I want 回答の正誤をすぐ知って次の問題に進みたい, so that テンポよくプレイできる

#### Acceptance Criteria

1. WHEN the Answer_Judge receives an Answer, THE Answer_Judge SHALL mark the Answer correct if and only if the set of Tile types in the Answer equals the Wait_Tile set of the Hand
2. WHEN an Answer is judged correct, THE Game SHALL add the Question_Score to the Total_Score
3. WHEN an Answer is judged incorrect, THE Game SHALL award 0 points for the Question and leave the Total_Score unchanged
4. FOR ALL Hands, judging the Wait_Tile set of the Hand as the Answer SHALL produce a correct result (identity property)
5. FOR ALL Hands and Answers, THE Answer_Judge SHALL mark the Answer correct only if the set of missing Tile types (in the Wait_Tile set but not in the Answer) and the set of extra Tile types (in the Answer but not in the Wait_Tile set) are both empty
6. WHEN an Answer has been judged, THE UI SHALL display the next Question within 300 ms regardless of whether the Answer was correct or incorrect
7. WHEN an Answer has been judged, THE UI SHALL display the Feedback consisting of ○ (correct) or × (incorrect) and the points awarded for that Question for 700 ms, and SHALL NOT display Yaku, Fu, Han, or the Wait_Tile set during the game session
8. WHILE the Feedback is displayed, THE UI SHALL accept input for the next Question and THE Timer SHALL continue counting down
9. WHEN an Answered_Question is judged, THE Game SHALL record the Hand, the Wait_Tile set, the Answer, the correct/incorrect result, the Yaku list, Fu, Han, the Question_Score, and the awarded points in the order of answering
10. THE Game SHALL NOT impose an upper limit on the number of Questions answered within the 30 seconds
11. FOR ALL game sessions, THE Total_Score SHALL equal the sum of the awarded points of all Answered_Questions (accumulation invariant)

### Requirement 8: 結果と解説一覧の表示

**User Story:** As a プレイヤー, I want ゲーム後に各問題の解説を確認したい, so that 間違いから学べる

#### Acceptance Criteria

1. WHEN the game session ends, THE UI SHALL display the Total_Score, the number of Answered_Questions, and the number of correct Answered_Questions
2. WHEN the game session ends, THE UI SHALL display the Review_List containing every Answered_Question in the order answered
3. THE UI SHALL display for each entry in the Review_List: the Hand (tiles), the Wait_Tile set, the player's Answer, the correct/incorrect result, the Yaku list, Fu, Han, the Question_Score, and the awarded points
4. WHERE an Answered_Question was judged incorrect, THE UI SHALL display the awarded points as 0 together with the Question_Score that a correct answer would have earned, and SHALL display the missing Wait_Tiles and the extra Tiles, indicating that no Tiles are in a set when that set is empty
5. WHEN a Wait_Tile set has more than one Wait_Tile with different points, THE UI SHALL display the Yaku, Fu, Han, and points of each Wait_Tile and SHALL indicate which Wait_Tile gives the Question_Score (高目)
6. THE UI SHALL NOT display Discarded_Questions in the Review_List
7. IF the number of Answered_Questions is 0, THEN THE UI SHALL display a Total_Score of 0 and a message indicating that no Question was answered, and SHALL display an empty Review_List
8. THE UI SHALL display on the Result_Screen a return-to-start control, and SHALL display a ranking view control only WHILE the Ranking_Availability is 有効 (Requirement 10 criterion 13)
9. WHEN the player activates the return-to-start control on the Result_Screen, THE UI SHALL discard the finished session data and display the Start_Screen within 1 second
10. WHEN the player activates the ranking view control on the Result_Screen, THE UI SHALL display the Ranking_Screen
11. WHEN the Ranking_Screen opened from the Result_Screen is closed by the back control, THE UI SHALL display the Result_Screen with the Total_Score, the Review_List, and the Registration_Status unchanged

### Requirement 9: ランキング自動登録

**User Story:** As a プレイヤー, I want ゲーム終了時にスコアが自動で登録されてほしい, so that 操作なしで他のプレイヤーと競える

#### Acceptance Criteria

1. THE Result_Screen SHALL NOT contain a name input field or a register control for the initial registration
2. THE Ranking_Client SHALL treat a name as valid only if, after removing leading and trailing whitespace (including full-width spaces), its length is between 1 and 20 characters inclusive, counted in Unicode code points, and it contains no control characters
3. WHEN the game session ends, THE Ranking_Client SHALL perform the Connection_Check, and WHEN the Connection_Check succeeds, THE Ranking_Client SHALL send the Player_Name, the Total_Score, and the Session_Id of that game session to the Ranking_Server automatically, without any player operation
4. WHEN the game session ends with a Total_Score of 0 and 0 Answered_Questions and the Connection_Check succeeds, THE Ranking_Client SHALL still send the Player_Name and the Total_Score of 0 to the Ranking_Server
5. THE Ranking_Server SHALL enforce, by table constraints, the same name rule as criterion 2, a Total_Score that is an integer between 0 and 1,000,000 inclusive, and a Session_Id that is a non-empty string, for every inserted Ranking_Entry (assumption A15)
6. IF the Ranking_Server receives an invalid name or Total_Score, THEN THE Ranking_Server SHALL reject the registration with an error response and SHALL NOT change the ranking
7. WHEN the Ranking_Server accepts a registration, THE Ranking_Server SHALL store a new Ranking_Entry with the name, the Total_Score, the registration time, and the Session_Id, even if a Ranking_Entry with the same name already exists (the same name may be used by multiple players and may have multiple Ranking_Entries from different game sessions)
8. WHILE the registration request is in progress, THE UI SHALL display the Registration_Status as 登録中 on the Result_Screen
9. WHEN the Ranking_Server accepts a registration, THE UI SHALL display a registration-complete message and the resulting rank on the Result_Screen within 3 seconds of the request
10. THE Game SHALL register each game session at most once, so that a session with a successful registration is never registered again
11. IF the Connection_Check of criterion 3 succeeded and the Ranking_Client then receives no response to the registration request within 5 seconds or receives a communication error, THEN THE UI SHALL set the Registration_Status to 登録失敗, display a message indicating that the registration failed and a retry control on the Result_Screen, and SHALL keep the Total_Score and the Review_List displayed
12. WHEN the player activates the retry control, THE Ranking_Client SHALL send the same Player_Name, Total_Score, and Session_Id of that session to the Ranking_Server again
13. IF the Ranking_Server returns a validation error, THEN THE UI SHALL display the error reason on the Result_Screen and SHALL keep the Total_Score and the Review_List displayed
14. IF the Ranking_Server accepted a registration but the response was lost and the Ranking_Client retries with the same Session_Id, THEN THE Ranking_Server SHALL keep exactly 1 Ranking_Entry for that Session_Id (enforced by a uniqueness constraint on the Session_Id), and THE Ranking_Client SHALL treat a uniqueness violation of the Session_Id as a completed registration
15. IF a Total_Score of 0 is registered, THEN THE Ranking_Server SHALL accept it as a valid score
16. THE Ranking_Client SHALL send the Player_Name currently held by the Name_Store as the name of the registration, so that a game session is registered under the login name
17. IF the Connection_Check of criterion 3 fails, THEN THE Ranking_Client SHALL NOT send a registration request, and THE UI SHALL set the Registration_Status to 登録対象外 and display on the Result_Screen only the message 「オフラインのためランキングには登録されません」, without an error message or a retry control, while keeping the Total_Score and the Review_List displayed

### Requirement 10: ランキング表示

**User Story:** As a プレイヤー, I want 全員のランキングを見たい, so that 自分の順位を確認できる

#### Acceptance Criteria

1. WHEN the player activates the ranking view control on the Start_Screen or the Result_Screen, THE Ranking_Client SHALL perform the Connection_Check, and WHEN the Connection_Check succeeds, THE Ranking_Client SHALL request the ranking from the Ranking_Server and THE UI SHALL display it within 3 seconds of the request
2. THE Ranking_Server SHALL return up to the top 100 Ranking_Entries ordered by Total_Score in descending order, and for equal Total_Scores by earlier registration time first
3. THE UI SHALL display for each Ranking_Entry the rank, the name, the Total_Score, and the registration date
4. THE Ranking_Server SHALL assign the rank as 1 plus the number of Ranking_Entries with a strictly higher Total_Score, so that entries with equal Total_Score share the same rank
5. IF the Ranking_Server holds no Ranking_Entries, THEN THE UI SHALL display a message indicating that no scores are registered
6. IF the Connection_Check succeeded and the Ranking_Client then receives no response within 5 seconds or receives a communication error while fetching the ranking, THEN THE UI SHALL display a message indicating that the ranking could not be loaded and a retry control, and SHALL keep the other screens operable
7. THE UI SHALL escape every name when displaying it so that markup contained in a name is displayed as text
8. FOR ALL sets of Ranking_Entries, THE returned ranking SHALL contain at most 100 entries and SHALL be sorted so that each entry's Total_Score is greater than or equal to that of the next entry (ordering invariant)
9. FOR ALL registrations accepted by the Ranking_Server, a ranking fetched afterwards SHALL contain the registered entry whenever its rank is within the top 100 (registration and retrieval round-trip property)
10. WHEN multiple clients register concurrently, THE Ranking_Server SHALL store every accepted registration without loss
11. WHILE the Ranking_Screen displays Ranking_Entries, THE UI SHALL highlight every Ranking_Entry whose name equals the current Player_Name in a visually distinct style, and because names are not unique, Ranking_Entries of other players who use the same name may also be highlighted (assumption A10)
12. WHEN the player activates the back control on the Ranking_Screen, THE UI SHALL display the screen from which the Ranking_Screen was opened (Start_Screen or Result_Screen)
13. WHILE the Ranking_Availability is オフライン, THE UI SHALL hide the ranking view control on the Start_Screen and the Result_Screen, and SHALL NOT display an error message or a retry control concerning the ranking
14. WHILE the Ranking_Availability is 有効, THE UI SHALL display the ranking view control on the Start_Screen and the Result_Screen
15. IF the Connection_Check of criterion 1 fails, THEN THE UI SHALL set the Ranking_Availability to オフライン, hide the ranking view control, and keep the current screen displayed without an error message or a retry control

### Requirement 11: 動作環境

**User Story:** As a プレイヤー, I want PCでもスマホでも遊びたい, so that 手元の端末で気軽に参加できる

#### Acceptance Criteria

1. THE UI SHALL operate on the latest stable versions of Chrome, Edge, and Safari on PC, and on iOS Safari and Android Chrome on smartphones
2. THE UI SHALL lay out the Hand, the 34-Tile palette, the submit control, the clear control, the remaining time, and the Total_Score without horizontal scrolling at viewport widths from 360 px to 1920 px
3. THE UI SHALL render each palette Tile with a touch target of at least 40 px by 40 px at a viewport width of 360 px
4. THE UI SHALL accept both mouse and touch input for all controls
5. THE Game SHALL execute question generation, wait calculation, scoring, and judging in the client so that a game session in progress does not depend on communication with the Ranking_Server
6. IF the Ranking_Server is unreachable, THEN THE Game SHALL still allow login, a complete game session to be played, and the Review_List to be displayed
7. WHEN the application is launched, THE Ranking_Client SHALL perform the Connection_Check and THE UI SHALL set the Ranking_Availability according to the result (assumption A16)
8. WHEN the Start_Screen is displayed, THE Ranking_Client SHALL perform the Connection_Check and THE UI SHALL update the Ranking_Availability according to the result

### Requirement 12: 手牌文字列の解析と出力(開発・テスト用)

**User Story:** As a 開発者, I want 手牌を標準的な文字列表記で読み書きしたい, so that 問題データの保存とテストができる

#### Acceptance Criteria

1. WHEN a valid hand string is provided, THE Hand_Parser SHALL parse the string into a Hand. A valid hand string consists of 1 to 14 tiles written as one or more groups, where each group is 1 or more digits followed by exactly one suit letter m, p, s, or z (e.g., 123m456p789s1122z). The same suit letter may appear in more than one group, and the Hand_Parser SHALL treat the groups as one combined set of tiles for that suit
2. IF a hand string contains a character other than the digits 1-9 and the letters m, p, s, z, a digit sequence not followed by a suit letter, a suit letter not preceded by a digit, a z-suit number outside 1 to 7, or the digit 0 (red tiles are not supported), THEN THE Hand_Parser SHALL return an error indicating the invalid character or number and its zero-based position in the string, and SHALL NOT produce a Hand
3. IF a hand string is empty or contains more than 14 tiles, THEN THE Hand_Parser SHALL return an error indicating that the tile count is outside the range 1 to 14, and SHALL NOT produce a Hand
4. IF a hand string yields a Tile type held more than 4 times, THEN THE Hand_Parser SHALL return an error identifying that Tile type, and SHALL NOT produce a Hand
5. WHEN a Hand is provided, THE Hand_Serializer SHALL output a hand string in which tiles are grouped by suit in the order m, p, s, z, with numbers in ascending order within each suit, and each suit letter appears at most once and only for suits that contain at least 1 tile
6. FOR ALL valid Hands, parsing the output of the Hand_Serializer SHALL produce a Hand equivalent to the original, where equivalence means the same count of each Tile type (round-trip property)
7. FOR ALL valid hand strings, serializing the parsed Hand and parsing the result SHALL produce a Hand equivalent to the first parsed Hand (parse → print → parse round-trip property)
8. FOR ALL valid Hands, THE Hand_Serializer SHALL produce the same string for every permutation of the Tiles in the Hand (canonical form property)

### Requirement 13: 名前のみのログイン

**User Story:** As a プレイヤー, I want 名前だけを入力して利用を始めたい, so that パスワードなしで手軽にランキングへ参加できる

#### Acceptance Criteria

1. WHEN the application is launched and the Name_Store holds no Player_Name, THE UI SHALL display the Login_Screen containing a name input field and a confirm control, without a password field
2. THE UI SHALL treat a name as valid only if, after removing leading and trailing whitespace (including full-width spaces), its length is between 1 and 20 characters inclusive, counted in Unicode code points, and it contains no control characters
3. IF the player activates the confirm control with an invalid name, THEN THE UI SHALL display a message identifying the violated condition (empty, longer than 20 characters, or containing control characters), SHALL NOT save the name, SHALL keep the Login_Screen displayed, and SHALL keep the input field editable
4. WHEN the player activates the confirm control with a valid name, THE Name_Store SHALL save the trimmed name as the Player_Name in the browser localStorage and THE UI SHALL display the Start_Screen within 1 second, without communicating with the Ranking_Server
5. THE Game SHALL allow multiple players to use the same name, and THE Game SHALL NOT check the uniqueness of a name (assumption A10)
6. WHEN the application is launched and the Name_Store holds a Player_Name, THE UI SHALL skip the Login_Screen and display the Start_Screen
7. THE UI SHALL display the current Player_Name on the Start_Screen, escaped so that markup contained in the name is displayed as text
8. WHEN the player activates the name change control on the Start_Screen, THE UI SHALL display the Login_Screen with the current Player_Name prefilled in the input field
9. WHEN the player confirms a valid name on the Login_Screen opened by the name change control, THE Name_Store SHALL replace the saved Player_Name with the new trimmed name and THE UI SHALL display the Start_Screen with the new name
10. WHEN the player changes the name, THE Ranking_Server SHALL keep the existing Ranking_Entries under the previous name unchanged, and THE Ranking_Client SHALL register later game sessions under the new name
11. WHILE the Login_Screen is opened by the name change control, THE UI SHALL allow the player to return to the Start_Screen without changing the name
12. IF the browser localStorage is unavailable, THEN THE Name_Store SHALL hold the Player_Name in memory for the current page session only, and THE UI SHALL display on the Login_Screen a message indicating that the name will not be remembered and must be entered again on the next launch
13. THE Game SHALL NOT require a password or an account, and SHALL NOT authenticate the player
14. THE Ranking_Server SHALL store only Ranking_Entries (name, Total_Score, registration time, Session_Id), THE Name_Store SHALL store only the Player_Name in the browser, and THE Game SHALL NOT persist per-question review data (assumption A13)
15. FOR ALL valid names, saving the name to the Name_Store and then reading it SHALL return the trimmed name (round-trip property)
16. WHILE the Ranking_Availability is オフライン, THE UI SHALL allow login and name change in the same way as while the Ranking_Availability is 有効

### Requirement 14: 説明画面

**User Story:** As a プレイヤー, I want ゲームのルールを確認したい, so that 遊び方や点数の前提を理解できる

#### Acceptance Criteria

1. THE UI SHALL display an explanation control on the Start_Screen at all times the Start_Screen is displayed
2. WHEN the player activates the explanation control, THE UI SHALL display the Explanation_Screen
3. THE Explanation_Screen SHALL describe the 30秒タイムアタックのルール, namely that the player answers as many Questions as possible within 30 seconds and that the Total_Score is the sum of the points of correctly answered Questions
4. THE Explanation_Screen SHALL describe the answering method, namely that the player selects every Wait_Tile and then activates the submit control
5. THE Explanation_Screen SHALL describe that an incorrect answer awards 0 points and the game proceeds to the next Question
6. THE Explanation_Screen SHALL describe that 3 consecutive correct answers make the next Question a Chinitsu_Question and that the Streak is reset to 0 when the Chinitsu_Question is presented
7. THE Explanation_Screen SHALL describe the scoring premises: 子, ロン, 門前, リーチ付き, ドラなし, 東場南家, and that the highest points among the Wait_Tiles (高目) are adopted
8. THE Explanation_Screen SHALL describe that a Question not yet submitted when the time limit is reached is invalid and excluded from the score and the Review_List
9. WHEN the player activates the back control on the Explanation_Screen, THE UI SHALL display the Start_Screen
10. THE UI SHALL NOT display the explanation control on the Game_Screen, so that the Timer is not affected by reading the Explanation_Screen during a game session

### Requirement 15: 技術構成とサーバー側の制約

**User Story:** As a 運営者, I want 専用サーバーなしで配布でき、公開キーでも最低限のデータ保護がある構成にしたい, so that 社内で手軽に運用できる

#### Acceptance Criteria

1. THE Game SHALL be implemented in TypeScript and SHALL be built into a single index.html file in which all JavaScript and CSS are inlined (assumption A14)
2. WHEN the built index.html is served from static hosting or opened as a placed file, THE Game SHALL operate without a dedicated application server
3. THE Ranking_Client SHALL connect to the Ranking_Server directly from the browser with supabase-js using the anon key embedded in the index.html, and SHALL use the Ranking_Server only for Ranking_Entry registration, Ranking_Entry retrieval, and the Connection_Check
4. THE Ranking_Server SHALL allow the anon role to INSERT and SELECT Ranking_Entries by RLS policies
5. IF the anon role attempts to UPDATE or DELETE a Ranking_Entry, THEN THE Ranking_Server SHALL reject the operation and leave the stored data unchanged
6. IF an INSERT of a Ranking_Entry violates the name rule (after trimming, 1 to 20 Unicode code points, no control characters), THEN THE Ranking_Server SHALL reject the INSERT by a table constraint
7. IF an INSERT of a Ranking_Entry has a Total_Score that is not an integer between 0 and 1,000,000 inclusive, THEN THE Ranking_Server SHALL reject the INSERT by a table constraint
8. IF an INSERT of a Ranking_Entry has a Session_Id that is already stored, THEN THE Ranking_Server SHALL reject the INSERT by a uniqueness constraint
9. THE Ranking_Server SHALL accept an INSERT of a Ranking_Entry whose name equals the name of an existing Ranking_Entry, because names are not unique (assumption A10)
10. THE Game SHALL accept score tampering, impersonation, and client modification as out of scope, and SHALL rely on criteria 4 to 8 as the only server-side protections (assumption A15)
