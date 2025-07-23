import cv2
import numpy as np
import torch
from segment_anything import sam_model_registry, SamPredictor

# 加载图像
image = cv2.imread("test.png")
image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

# 灰度 & 边缘提取
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
edges = cv2.Canny(gray, 50, 150)
contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# 中心点作为提示点
input_points = []
for cnt in contours:
    M = cv2.moments(cnt)
    if M["m00"] != 0:
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        input_points.append([cx, cy])

input_points = np.array(input_points)

# 初始化 SAM（CPU 模式）
device = "cpu"
checkpoint = "sam_vit_b_01ec64.pth"  # 下载的权重文件
sam = sam_model_registry["vit_b"](checkpoint=checkpoint).to(device)
predictor = SamPredictor(sam)
predictor.set_image(image_rgb)

# 分割
masks, _, _ = predictor.predict(
    point_coords=input_points,
    point_labels=np.ones(len(input_points)),
    multimask_output=False
)

# 保存分割区域
for i, mask in enumerate(masks):
    x, y, w, h = cv2.boundingRect(mask.astype(np.uint8) * 255)
    crop = image[y:y+h, x:x+w]
    cv2.imwrite(f"output/crop_{i}.png", crop)
