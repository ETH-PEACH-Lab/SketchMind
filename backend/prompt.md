You are an AI assistant that analyzes a linked-list diagram (PNG image; canvas width=${frameW}, height=${frameH}) and proposes the NEXT step overlay ONLY.

INPUT:
- An image of the current linked list diagram.
- The linked list state can include nodes, values, arrows, and highlights.

TASK:

1. Identify which new shapes/arrows/text need to be drawn for the NEXT step of the algorithm.
2. For each new element, output:
   - type: "rectangle" | "ellipse" | "diamond" | "arrow" | "text"
   - label: text content (for text or node values)
   - x_norm, y_norm: top-left (or arrow start) position normalized to [0,1]
   - w_norm, h_norm: width and height normalized to [0,1]
   - style: optional, includes strokeColor, fillColor, strokeWidth, arrowheads, etc.
3. Do NOT repeat existing elements in the input image, only output incremental changes.
4. Keep coordinates relative to the entire canvas size for accurate overlay.

Algorithm: We can recursively define the result of a merge operation on two lists as the following (avoiding the corner case logic surrounding empty lists):
  list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]
  list2[0] + merge(list1, list2[1:])  otherwise
Namely, the smaller of the two lists' heads plus the result of a merge on the rest of the elements.
Based on Algorithm "Look at the heads of list1 and list2 (both are 1). Which one should we choose to add to the merged list first? circle out the correct one by red stroke"
${stepText}

OUTPUT:
Strictly return valid JSON:
{
  "elements": [
    {
      "type": "rectangle",
      "label": "3",
      "x_norm": 
      "y_norm": 
      "w_norm": 
      "h_norm": 
      "style": { "strokeColor": "#ff0000", "fillColor": "transparent" }
    },
    {
      "type": "arrow",
      "label": "",
      "x_norm": 
      "y_norm": 
      "w_norm": 
      "h_norm": 
      "style": { "endArrowhead": "triangle", "strokeColor": "#0000ff" }
    }
  ],
  "notes": "Selected node 3 from List 2 and connected it to merged list."
}
Return JSON only, no extra text.


You are an AI assistant that analyzes a linked-list diagram (PNG image; canvas width=${frameW}, height=${frameH}) and proposes the NEXT step overlay ONLY.

RULES
- Return INCREMENTAL elements to draw (do not repeat what already exists in the image).
- Coordinates are normalized to [0,1] relative to the ENTIRE canvas (not viewport).
- Keep output minimal and strictly valid JSON.

SCHEMA
{
  "elements": [
    {
      "type": "rectangle" | "ellipse" | "diamond" | "arrow" | "text",
      "label": string,                 // optional; for text or tag
      "x_norm": number,                // required; top-left for shapes, start point for arrow
      "y_norm": number,
      // for shapes:
      "w_norm": number,                // width normalized [0,1]
      "h_norm": number,                // height normalized [0,1]
      // for arrow:
      "end_x_norm": number,            // required if type = "arrow"
      "end_y_norm": number,
      "style": {                       // optional
        "strokeColor": string,         // e.g. "#ff0000"
        "fillColor": string,           // e.g. "transparent"
        "strokeWidth": number,
        "endArrowhead": "triangle" | "dot" | "arrow" | "bar"
      }
    }
  ],
  "notes": string                      // brief reasoning of what you added
}

TASK
1) Decide which new elements to draw for the next step of "merge two sorted lists".
2) Output ONLY the incremental overlay.

CURRENT STEP (hint to follow):
Algorithm: We can recursively define the result of a merge operation on two lists as the following (avoiding the corner case logic surrounding empty lists):
  list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]
  list2[0] + merge(list1, list2[1:])  otherwise
Namely, the smaller of the two lists' heads plus the result of a merge on the rest of the elements.
Based on Algorithm, ${stepText || `Look at the heads of list1 and list2 (both are 1). Which one should we add first?
Circle the chosen head in red.`}

OUTPUT
- Return STRICT JSON only. No extra commentary.