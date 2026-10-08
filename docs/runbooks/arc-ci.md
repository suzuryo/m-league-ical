# CI の実行先と GitHub-hosted への手動切替

`arf-linux` は suzuryo/actions-runner-fleet の arf-scaler が供給する self-hosted runner の label で、Windows x64 か Mac ARM64 の
Docker Desktop で job ごとに runner と DinD の container を作って捨てる。
architecture を固定する label は `arf-linux-x64` / `arf-linux-arm64`。枠と共有の仕方は
[fleet の runbook](https://github.com/suzuryo/actions-runner-fleet/blob/main/docs/runbooks/ci-runners.md) を参照する。

同一 repository の PR CI と `main` push の Pages は、通常 `arf-linux` の
使い捨て runner を使用する。CI の Node / pnpm の準備と検査内容は従来どおり。

公開 repository の fork PR は通常 GitHub-hosted で実行する。
GitHub 側でも全 external contributor の workflow 承認を必須とし、自動承認はしない。
workflow の runner 条件だけを fork の認可境界にはしない。

self-hosted runner（arf-scaler）が利用できない場合、操作者が対象 workflow と ref を選んで hosted run を起動する。

```bash
mise run ci:github-hosted
mise run ci:github-hosted -- ci.yml feature/example
```

既定は `ci.yml` / `main`。許可する workflow は `ci.yml` と `github-pages.yml` だけ。
GitHub CLI の認証と workflow dispatch 権限が必要。
Actions UI の runner choice は `arc`（既定、self-hosted の `arf-linux`）か `github-hosted` で、後者を選ぶと hosted を使う。

`mise run ci:github-hosted -- github-pages.yml main` は実際の Pages 配信を行う。
検証目的では dispatch しない。既存の `main` push、Pages environment、権限、
concurrency と公開対象の `public/` は保持する。

手動実行は新しい run を作る。既存 run の rerun は元の runner 選択を引き継ぎ、
手動 run が PR merge SHA の required check を自動的に置き換えることはない。
自動 fallback と Dependabot Updates の設定変更は行わない。

## 非変更の検証

```bash
python3 -m unittest discover -s tests -p '*_test.py'
bash -n mise-tasks/ci/github-hosted.sh
actionlint
```

helper のテストは一時 directory の fake `gh` を使用し、GitHub へ接続しない。
