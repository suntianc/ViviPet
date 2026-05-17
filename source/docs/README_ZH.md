<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/suntianc/ViviPet/main/apps/desktop/assets/icon.png">
    <img alt="ViviPet" src="../imgs/vivi-pet-banner.png" width="1200">
  </picture>
  <h1 align="center">ViviPet</h1>
  <p align="center"><strong>AI 驱动的 Live2D 桌宠伴侣</strong></p>
  <p align="center">
    <code>一个轻量的 Live2D 桌面宠物</code>
  </p>

  <p align="center">
    <a href="https://github.com/suntianc/ViviPet/releases">
      <img src="https://img.shields.io/github/v/release/suntianc/ViviPet?style=flat-square&logo=github&label=版本" alt="Version">
    </a>
    <a href="https://github.com/suntianc/ViviPet/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/suntianc/ViviPet?style=flat-square" alt="License">
    </a>
    <a href="https://github.com/suntianc/ViviPet/stargazers">
      <img src="https://img.shields.io/github/stars/suntianc/ViviPet?style=flat-square&logo=github" alt="Stars">
    </a>
    <a href="https://github.com/suntianc/ViviPet/actions">
      <img src="https://img.shields.io/github/actions/workflow/status/suntianc/ViviPet/ci.yml?style=flat-square&logo=githubactions" alt="CI">
    </a>
    <a href="https://github.com/suntianc/ViviPet/issues">
      <img src="https://img.shields.io/github/issues/suntianc/ViviPet?style=flat-square&logo=github" alt="Issues">
    </a>
  </p>
</div>

<br />
 <p align="center">
    <a href="README_EN.md">English</a> |
    <a href="README_ZH.md">简体中文</a>
  </p>

> **ViviPet** 是一个轻量的 Live2D 桌面宠物，支持丰富动作表现、气泡文本和可选 TTS。
---

## 🎬 演示

https://github.com/user-attachments/assets/6f3d3bb6-32da-401b-85fd-4722f299a55a

---

## 功能特性

<div align="center">

| 功能 | 描述 |
|---|---|
| **丰富表情系统** | 基于 Live2D Cubism 5 —— 思考、说话、开心、困惑、生气等多种表情 |
| **多源 TTS** | 系统语音（macOS say）· 本地服务 · 云端 API |
| **鼠标感知** | 眼睛跟随光标移动——它总知道你在看哪里 |
| **自定义模型支持** | 通过托盘菜单导入你自己的 Live2D 模型 |
| **轻量设计** | 无框、透明、置顶——安静地待在角落 |
| **桌面应用** | 基于 Electron IPC 驱动桌宠、托盘菜单和模型管理 |

</div>

---

## TTS 语音系统

ViviPet 拥有灵活的 TTS 系统，支持**三种提供者类型**和**三种请求模式**。

| 类型 | 描述 | 配置 |
|:--------:|-------------|--------|
| `system` | macOS `say` 命令 | 语音选择、语速控制 |
| `local` | 自托管 TTS 服务 | 自定义端点 URL、音频格式 |
| `cloud` | OpenAI / ElevenLabs / Azure | API 密钥、语音、模型选择 |

### Local 请求模式

| 模式 | 用途 | 示例 |
|:----:|---------|---------|
| `preset` | 使用预设语音 | `{ "text": "你好", "voice": "nova", "model": "preset" }` |
| `clone` | 语音克隆 | `{ "text": "你好", "model": "clone" }` |
| `instruct` | 指令控制语音风格 | `{ "text": "你好", "instruct": "轻声细语", "model": "instruct" }` |
- 克隆模式需要提前在您的 tts 服务中配置好参考音频
- 本应用测试使用模型为 Qwen3-TTS-12Hz-1.7B-Base-8bit、Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit、Qwen3-TTS-12Hz-1.7B-VoiceDesign-8bit
- tts 服务样例详见：source/example/tts_server_example/api_tts.py"
---

## 添加 Live2D 模型（此功能暂未完成测试）

1. **准备** Live2D Cubism 5 模型（`.model3.json`、`.moc3`、纹理、物理、动作）并打包成 zip
2. **导入** 点击菜单中的导入，将你的模型文件导入进去

> 完整模型集成规范见 [specification/live2d-model-integration-spec.md](specification/live2d-model-integration-spec.md)

---

## 🤝 贡献指南

欢迎各种形式的贡献！无论是：

- **新的 Live2D 模型** —— 分享你的角色创作
- **Bug 修复** —— 发现问题？提交 PR
- **功能建议** —— 新的动作、集成方式或 TTS 提供者
- **文档** —— 帮助其他人快速上手

欢迎随时提交 [Pull Request](https://github.com/suntianc/ViviPet/pulls) 或 [创建 Issue](https://github.com/suntianc/ViviPet/issues)。

---

## 📄 开源协议

[GNU General Public License v3.0](LICENSE) —— 详情见 [LICENSE](LICENSE) 文件。

---

## 致谢
由衷感谢 **@bailyovo** 提供免费 Live2D 模型，她的<a href="https://bailyovo.booth.pm">商铺地址</a>
<div align="center">
  <p>
    <sub>
      用 💖 和 Live2D Cubism 5 制作 ·
      <a href="https://www.live2d.com/">Live2D Inc.</a>
    </sub>
  </p>
  <p>
    <sub>基于 Electron · React · TypeScript · Vite · WebGL 构建</sub>
  </p>
  <br />
  <p>
    <a href="https://github.com/suntianc/ViviPet">
      <img src="https://img.shields.io/github/stars/suntianc/ViviPet?style=social" alt="在 GitHub 上点赞" />
    </a>
    <a href="https://github.com/suntianc/ViviPet/fork">
      <img src="https://img.shields.io/github/forks/suntianc/ViviPet?style=social" alt="在 GitHub 上 Fork" />
    </a>
  </p>
</div>
