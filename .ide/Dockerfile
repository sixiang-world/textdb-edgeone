# TextDB EdgeOne — CNB 云原生开发环境
#
# 基于 CNB 默认构建环境（已含 Node.js 22、uv、oh-my-zsh、code-server 等）。
# 本项目额外安装 Tailwind CSS / ESLint / Prettier / React / TypeScript 插件。
# 支持 WebIDE、VSCode、Cursor、CodeBuddy 等客户端连接。
#
# 参考: https://cnb.cool/cnb/cool/default-dev-env

FROM cnbcool/default-build-env:latest

# 安装本项目需要的 VSCode 插件
# - 默认环境已含: cnb-welcome, vscode-yaml, git-graph, githistory, live-server,
#   coding-copilot, markdown-mermaid
# - 本项目额外安装:
RUN code-server --install-extension bradlc.vscode-tailwindcss \
    && code-server --install-extension dbaeumer.vscode-eslint \
    && code-server --install-extension esbenp.prettier-vscode \
    && code-server --install-extension dsznajder.es7-react-js-snippets \
    && code-server --install-extension usernamehw.errorlens \
    && echo "extensions installed"

# 编辑器配置（formatOnSave、Prettier 默认格式化、Tailwind CSS class 补全等）
COPY .ide/settings.json /root/.local/share/code-server/Machine/settings.json
