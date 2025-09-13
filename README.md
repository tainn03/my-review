<div align="center">

# 🧠 my-review – AI Code Review Action

AI-powered automated code review for GitHub Pull Requests using Google's Gemini models.

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Publish%20Action-informational?logo=github-actions&labelColor=30363c)](./action.yml)
![Language](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript)
![Node](https://img.shields.io/badge/Node-20-green?logo=node.js)
![Gemini](https://img.shields.io/badge/Gemini-1.5-blueviolet)
![License](https://img.shields.io/badge/License-ISC-lightgrey)

</div>

> Tài liệu bằng tiếng Việt (Vietnamese). Scroll further you can easily read even without Vietnamese knowledge thanks to code samples.

---

## 📑 Mục lục

1. [Giới thiệu](#-giới-thiệu)
2. [Tính năng chính](#-tính-năng-chính)
3. [Cách hoạt động](#-cách-hoạt-động)
4. [Kiến trúc & Luồng xử lý](#-kiến-trúc--luồng-xử-lý)
5. [Yêu cầu](#-yêu-cầu)
6. [Sử dụng nhanh](#-sử-dụng-nhanh)
   - [Dùng như GitHub Action](#dùng-như-github-action)
   - [Chạy bằng Docker image](#chạy-bằng-docker-image)
7. [Tích hợp vào repo cá nhân (workflow mẫu)](#-tích-hợp-vào-repo-cá-nhân-workflow-mẫu)
8. [Biến môi trường / Inputs](#-biến-môi-trường--inputs)
9. [Quyền & Bảo mật](#-quyền--bảo-mật)
10. [Phát triển local](#-phát-triển-local)
11. [Build & Publish Docker image](#-build--publish-docker-image)
12. [Troubleshooting](#-troubleshooting)
13. [Roadmap](#-roadmap)
14. [License](#-license)

---

## 💡 Giới thiệu

`my-review` là một GitHub Action giúp tự động phân tích diff của Pull Request và tạo các nhận xét (review comments) trực tiếp trên PR bằng AI (Google Gemini). Mục tiêu: tăng tốc độ review, phát hiện vấn đề style, bug logic, gợi ý cải thiện.

## 🚀 Tính năng chính

- Đọc diff commit cuối của Pull Request.
- Sinh prompt tối ưu gửi tới Gemini model.
- Parse phản hồi AI thành danh sách comment hợp lệ.
- Tự động post từng comment vào đúng file & dòng.
- Tách biệt phần sinh nội dung và phần tương tác GitHub.
- Có thể chạy: GitHub Action (node20) hoặc Docker container.

## 🔄 Cách hoạt động

1. Workflow kích hoạt khi PR mở / cập nhật (`pull_request` events).
2. Lấy diff mới nhất của commit cuối PR.
3. Tạo prompt và gọi Gemini qua SDK `@google/genai`.
4. Chuẩn hóa JSON trả về (tolerant parsing) -> danh sách comment.
5. Gửi từng comment lên PR thông qua GitHub API.
6. Ghi log tiến trình trong Action runner.

## 🧬 Kiến trúc & Luồng xử lý

```
GitHub Action Runner
	│
	├─▶ src/index.ts (entry)
	│     ├─▶ GithubService.getLatestCommitDiff()
	│     ├─▶ GeminiAiService.generateReviewCode()
	│     │       ├─▶ build prompt (ContentUtil)
	│     │       └─▶ call Gemini API
	│     └─▶ postComment() lặp qua kết quả
	│
	└─▶ Logs + Review Comments trên PR
```

## 🧱 Yêu cầu

- Repository sử dụng GitHub Actions.
- `GEMINI_API_KEY` (Google AI Studio / Gemini API key) có quyền gọi model mong muốn.
- Node 20 (Action đã khai báo `using: node20`).
- Nếu chạy qua Docker image private cần quyền pull (GHCR visibility public nếu muốn cộng đồng dùng không cần login).

## ⚡ Sử dụng nhanh

### Dùng như GitHub Action

Tạo file `.github/workflows/ai-review.yml` trong repo của bạn:

```yaml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  contents: read
  pull-requests: write
  packages: read
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Run review code in Docker container
        run: |
          set -e
          docker pull ghcr.io/tainn03/my-review:latest
          docker run --rm \
            -e INPUT_GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }} \
            -e INPUT_GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }} \
            -e INPUT_MODEL=gemini-2.5-flash \
            -e INPUT_OWNER=${{ github.repository_owner }} \
            -e INPUT_REPO=${{ github.event.repository.name }} \
            -e INPUT_PULL_NUMBER=${{ github.event.pull_request.number }} \
            ghcr.io/tainn03/my-review:latest
```

### Chạy bằng Docker image

```bash
docker pull ghcr.io/tainn03/my-review:latest
docker run --rm \
	-e INPUT_GITHUB_TOKEN=<gh_token> \
	-e INPUT_GEMINI_API_KEY=<gemini_key> \
	-e INPUT_MODEL=gemini-2.5-pro \
	-e INPUT_OWNER=<owner> \
	-e INPUT_REPO=<repo> \
	-e INPUT_PULL_NUMBER=1 \
	ghcr.io/tainn03/my-review:latest
```

Nếu image là private trên GHCR, cần login:

```bash
echo <PAT_WITH_read:packages> | docker login ghcr.io -u <username> --password-stdin
```

## 🔌 Tích hợp vào repo cá nhân (workflow mẫu)

Ví dụ workflow dùng Docker image (ít phụ thuộc action metadata):

```yaml
name: AI Code Review (Docker)
on:
	pull_request:
		types: [opened, synchronize, reopened]
jobs:
	review:
		runs-on: ubuntu-latest
		permissions:
			contents: read
			pull-requests: write
		steps:
			- uses: actions/checkout@v4
			- name: (Optional) Login GHCR if private
				if: ${{ vars.REVIEW_IMAGE_PRIVATE == 'true' }}
				uses: docker/login-action@v3
				with:
					registry: ghcr.io
					username: ${{ github.actor }}
					password: ${{ secrets.GITHUB_TOKEN }}
			- name: Run AI review
				run: |
					docker pull ghcr.io/tainn03/my-review:latest
					docker run --rm \
						-e INPUT_GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }} \
						-e INPUT_GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }} \
						-e INPUT_MODEL=gemini-1.5-pro \
						-e INPUT_OWNER=${{ github.repository_owner }} \
						-e INPUT_REPO=${{ github.event.repository.name }} \
						-e INPUT_PULL_NUMBER=${{ github.event.pull_request.number }} \
						ghcr.io/tainn03/my-review:latest
```

## 🧾 Biến môi trường / Inputs

| Input / Env                               | Bắt buộc | Mô tả                                       | Ví dụ                         |
| ----------------------------------------- | -------- | ------------------------------------------- | ----------------------------- |
| `github_token` / `INPUT_GITHUB_TOKEN`     | ✔        | Token mặc định của workflow để post comment | `${{ secrets.GITHUB_TOKEN }}` |
| `gemini_api_key` / `INPUT_GEMINI_API_KEY` | ✔        | API Key Gemini                              | `AI...`                       |
| `model` / `INPUT_MODEL`                   | ✔        | Tên model Gemini                            | `gemini-1.5-pro`              |
| `owner` / `INPUT_OWNER`                   | ✔        | Chủ sở hữu repo                             | `tainn03`                     |
| `repo` / `INPUT_REPO`                     | ✔        | Tên repository                              | `my-review`                   |
| `pull_number` / `INPUT_PULL_NUMBER`       | ✔        | Số PR cần review                            | `42`                          |

## 🔐 Quyền & Bảo mật

- Không log ra giá trị secret.
- Chỉ yêu cầu quyền `pull-requests: write` để tạo comment.
- Giữ image public nếu muốn cộng đồng dùng không cần login.
- Nếu cần hạn chế truy cập: giữ image private và cung cấp `read:packages` PAT riêng (ít thân thiện cộng đồng).

## 🛠 Phát triển local

```bash
git clone https://github.com/tainn03/my-review.git
cd my-review
npm install
npm run build
node dist/index.js \
	# Cần export tạm biến môi trường hoặc mock core.getInput trong dev nếu muốn chạy tay.
```

Trong thực tế `@actions/core.getInput` kỳ vọng inputs từ Action context. Khi dev local, bạn có thể tạo file `.env` và sửa `package.json` script hoặc viết script wrapper.

## 🏗 Build & Publish Docker image

```bash
docker build -t ghcr.io/tainn03/my-review:latest .
echo <PAT_WITH_write:packages> | docker login ghcr.io -u <username> --password-stdin
docker push ghcr.io/tainn03/my-review:latest
```

Để image public: GitHub > Packages > my-review > Change visibility.

## 🧯 Troubleshooting

| Vấn đề                                         | Nguyên nhân khả dĩ                  | Cách khắc phục                                             |
| ---------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| 401 khi docker pull                            | Image private                       | Login GHCR hoặc mở public                                  |
| `AI did not return any valid review comments.` | Output Gemini không parse được JSON | Điều chỉnh prompt / model hoặc log thô để debug (tạm thời) |
| Không có comment nào                           | Diff rỗng, PR không thay đổi        | Kiểm tra PR có commit mới                                  |
| Lỗi model quota                                | Hết hạn mức Gemini                  | Nâng hạn mức hoặc đổi API key                              |
| Timeout lâu                                    | Diff lớn                            | Xem xét giới hạn kích thước diff trước khi gửi             |

## 🗺 Roadmap

- [ ] Output summary tổng hợp cuối PR.
- [ ] Hỗ trợ gợi ý patch tự động (suggested changes).
- [ ] Cấu hình ngưỡng độ dài diff.
- [ ] Multi-model fallback.
- [ ] Unit tests & coverage.

## 📄 License

ISC © 2025 tainn03

---
