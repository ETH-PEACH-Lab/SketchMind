# Re-import necessary modules after state reset
import numpy as np
import cv2
import matplotlib.pyplot as plt

# Reload the image
image = cv2.imread(r"C:\Users\wy\Desktop\SketchMind\image_segmentation\test1.png")

image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

# Apply grayscale and thresholding for segmentation mockup
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
_, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

# Detect contours to simulate segmentation
contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
segmented_image = image_rgb.copy()
cv2.drawContours(segmented_image, contours, -1, (0, 255, 0), 2)

# Plot the results
fig, axes = plt.subplots(1, 2, figsize=(12, 6))
axes[0].imshow(image_rgb)
axes[0].set_title("Original Image")
axes[0].axis("off")

axes[1].imshow(segmented_image)
axes[1].set_title("Segmented (Contour-based)")
axes[1].axis("off")

plt.tight_layout()
plt.show()
