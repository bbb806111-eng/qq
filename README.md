# 漫剧剧本师（多智能体联合协作）

这是一个可直接运行的 **多智能体漫剧剧本生成器**，支持：

- 自动分析（题材/冲突/情绪曲线）
- 自动架构（三幕节拍 + 场景蓝图）
- 自动创作（分镜 + 旁白 + 对白 + 悬念）
- 自动检查（多维评分 + 修订建议 + 自动补写）

## 快速开始

```bash
python manju_scriptor.py --theme "失重校园的最后一场考试" --genre "青春科幻" --scenes 6 --out output.md
```

查看终端输出：

```bash
python manju_scriptor.py --theme "赛博城最后的灯"
```

输出结构化 JSON（便于接入你自己的系统）：

```bash
python manju_scriptor.py --theme "机械神明的遗嘱" --json
```

## 多智能体架构

1. `AnalyzerAgent`：提炼核心冲突、情绪曲线、受众抓手。
2. `ArchitectAgent`：生成故事节拍（beat sheet）与场景蓝图。
3. `WriterAgent`：批量生产可拍摄的场景化剧本。
4. `CriticAgent`：自动评分并给出修订动作，输出终稿。
5. `Director`：统一调度，串联工作流。

## 输出质量策略

- 强制每场景推动剧情（避免“水剧情”）
- 对白短句化，强调可视化与传播性
- 使用评分机制推动自动修订，保证稳定质量

## 可扩展方向

- 接入真实 LLM API（替换每个 Agent 的规则逻辑）
- 加入角色设定库、世界观数据库
- 支持“多轮修订直到达到目标分”
- 输出 Storyboard JSON 给前端分镜工具
