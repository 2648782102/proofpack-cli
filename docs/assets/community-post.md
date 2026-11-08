# Community post draft

Suggested Chinese title:

```text
AI 改完代码后，我给每次改动留一张“验收小票”
```

Body:

```markdown
用 coding agent 改代码时，我最常卡在最后一步：它说“完成并测试通过”，但我还要自己确认到底改了哪些文件、哪些命令真的跑过、哪些检查根本没跑。

所以做了一个本地小工具 Proofpack：把 Git 能看到的改动、显式跑过的命令结果、启发式检查提醒和“未检查项”放进一张 Markdown/JSON 报告里。它不上传代码、不自动发现并执行 package scripts、不调用模型，也不会给“可以合并”的结论。

最常用的一条命令：

```sh
npx -y --package=proofpack-cli@0.3.2 proofpack check --run "npm test"
```

默认检查是只读的；只有显式写在 `--run` 里的命令才会执行。它也提供本地 MCP stdio adapter，暴露一个只读 `proofpack_check` 工具，给 Codex / Claude Desktop 这类 host 直接生成报告，但 MCP 侧不会执行项目命令。

项目还很早期。想听听大家两个反馈：

1. 报告里「没跑」和「跑过且通过」是否足够难混淆？
2. CLI 负责显式检查、MCP 只读这个边界是否好理解？

仓库：https://github.com/2648782102/proofpack-cli
```

Before publishing: choose one community, read its current self-promotion rules, and replace generic claims with the exact platform's preferred link/tag format. Do not cross-post the same text simultaneously.
