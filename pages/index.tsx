import dynamic from 'next/dynamic';
import { useState, useRef, useEffect } from 'react';
// import StoryPlayer from '../components/StoryPlayer';
import storySteps from '../data/merge-story.json';
import "@excalidraw/excalidraw/index.css"; 
// import { loadLibraryFromSVGImages } from "../utils/loadLibraryFromSVGImages";
import { injectSvgImagesAsLibraryItems } from "../utils/loadLibraryFromSVGImages";


const StoryPlayer = dynamic(() => import('../components/StoryPlayer'), {
  ssr: false
})

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

const MarkdownWithDrawing = dynamic(() => import('../components/MarkdownWithDrawing'), { ssr: false });
// const SVGWhiteboard = dynamic(() => import('../components/SVGWhiteboard'), { ssr: false });

export default function Home() {
  const [api, setApi] = useState(null);

  useEffect(() => {
    if (!api) return;

    injectSvgImagesAsLibraryItems(api, [
      "/files/array.svg",
      "/files/linked_list.svg",
      "/files/tree.svg",
      "/files/graph.svg",
      "/files/stack.svg",
      "/files/matrix.svg",
    ]);
  }, [api]);

//     const selectedText = `

// You are given the heads of two sorted linked lists \`list1\` and \`list2\`.

// Merge the two lists into one **sorted** list. The list should be made by **splicing together** the nodes of the first two lists. Return the head of the merged linked list.

// \`\`\`
// Input: list1 = [1,2,4], list2 = [1,3,4]
// Output: [1,1,2,3,4,4]
// \`\`\`

// Approach 1: Recursion
// \`\`\`
//   list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]
//   list2[0] + merge(list1, list2[1:])  otherwise
// \`\`\`
// `
    const selectedText = `
# 🧠 LeetCode 21: Merge Two Sorted Lists

## 📋 Problem Description

You are given the heads of two sorted linked lists \`list1\` and \`list2\`.

Merge the two lists into one **sorted** list. The list should be made by **splicing together** the nodes of the first two lists. Return the head of the merged linked list.

---

### Example

\`\`\`
Input: list1 = [1,2,4], list2 = [1,3,4]
\`\`\`



### Constraints

- The number of nodes in both lists is in the range \`[0, 50]\`.
- \`-100 <= Node.val <= 100\`
- Both \`list1\` and \`list2\` are sorted in **non-decreasing order**.

---

<details>
<summary>✅ Approach 1: Recursion</summary>

### Intuition

We can recursively define the result of a merge operation on two lists as the following (avoiding the corner case logic surrounding empty lists):

\`\`\`
  list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]
  list2[0] + merge(list1, list2[1:])  otherwise
\`\`\`

Namely, the smaller of the two lists' heads plus the result of a merge on the rest of the elements.

### Algorithm

We model the above recurrence directly, first accounting for edge cases. Specifically, if either of l1 or l2 is initially null, there is no merge to perform, so we simply return the non-null list. Otherwise, we determine which of l1 and l2 has a smaller head, and recursively set the next value for that head to the next merge result. Given that both lists are null-terminated, the recursion will eventually terminate.

### Complexity Analysis

**Time complexity**: O(n + m)  

Because each recursive call increments the pointer to l1 or l2 by one (approaching the dangling null at the end of each list), there will be exactly one call to mergeTwoLists per element in each list. Therefore, the time complexity is linear in the combined size of the lists.

**Space complexity**: O(n + m)  

The first call to mergeTwoLists does not return until the ends of both l1 and l2 have been reached, so n + m stack frames consume O(n + m) space.

</details>

---

<details>
<summary>✅ Approach 2: Iteration</summary>

### Intuition

We can achieve the same idea via iteration by assuming that l1 is entirely less than l2 and processing the elements one-by-one, inserting elements of l2 in the necessary places in l1.

### Algorithm

First, we set up a false "prehead" node that allows us to easily return the head of the merged list later. We also maintain a prev pointer, which points to the current node for which we are considering adjusting its next pointer. Then, we do the following until at least one of l1 and l2 points to null: if the value at l1 is less than or equal to the value at l2, then we connect l1 to the previous node and increment l1. Otherwise, we do the same, but for l2. Then, regardless of which list we connected, we increment prev to keep it one step behind one of our list heads.

After the loop terminates, at most one of l1 and l2 is non-null. Therefore (because the input lists were in sorted order), if either list is non-null, it contains only elements greater than all of the previously-merged elements. This means that we can simply connect the non-null list to the merged list and return it.

To see this in action on an example, check out the animation below:

<!-- animation-slot -->

### Complexity Analysis

**Time complexity**: O(n + m)  

Because exactly one of l1 and l2 is incremented on each loop iteration, the while loop runs for a number of iterations equal to the sum of the lengths of the two lists. All other work is constant, so the overall complexity is linear.

**Space complexity**: O(1)  

The iterative approach only allocates a few pointers, so it has a constant overall memory footprint.

</details>
`
;

  const [svgData, setSvgData] = useState('');
  const lastInserted = useRef<SVGElement[]>([]);
  const hintCounter = useRef(0);

  const renderTextOnSVG = (text: string) => {
    const svg = document.querySelector('svg');
    if (!svg || !text.trim()) return;
    const parser = new DOMParser();
    const y = 360 + hintCounter.current * 18;
    const hintText = `<text x="20" y="${y}" fill="gray" font-size="14">${text}</text>`;
    const doc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${hintText}</svg>`, 'image/svg+xml');
    const textNode = doc.documentElement.firstChild as SVGElement;
    svg.appendChild(textNode);
    lastInserted.current.push(textNode);
    hintCounter.current += 1;
  };

  const handleAI = async (mode: 'check' | 'nextDraw' | 'hintOnly') => {
    if (!selectedText || !svgData) {
      alert('Please select algorithm text and export the SVG first.');
      return;
    }

    const res = await fetch('/api/ai-draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, text: selectedText, svg: `<svg>${svgData}</svg>` }),
    });

    const data = await res.json();
    if (!data.result) return;

    if (mode === 'check' || mode === 'hintOnly') {
      renderTextOnSVG(data.result);
    } else if (mode === 'nextDraw') {
      const svgContainer = document.querySelector('svg');
      if (svgContainer) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${data.result}</svg>`, 'image/svg+xml');
        const newElements = Array.from(doc.documentElement.children);
        lastInserted.current = [];
        newElements.forEach((node) => {
          const cloned = node.cloneNode(true) as SVGElement;
          svgContainer.appendChild(cloned);
          lastInserted.current.push(cloned);
        });
      }
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left side */}
      <div className="w-1/2 relative bg-gray-100">
        <MarkdownWithDrawing markdown={selectedText} />
      </div>

      {/* Right side */}
      <div className="w-1/2 bg-white relative">
        <StoryPlayer steps={storySteps} />

        <div style={{ height: '900px' }}>
          <Excalidraw excalidrawAPI={(api) => setApi(api)} />     </div>

        <div className="relative top-1 right-2 z-10 flex flex-row flex-wrap gap-2 mt-2 px-4">
          <button onClick={() => handleAI('check')} className="bg-blue-500 text-white px-3 py-1 rounded">
            🧪 Check
          </button>
          <button onClick={() => handleAI('nextDraw')} className="bg-green-500 text-white px-3 py-1 rounded">
            🧭 Next Draw
          </button>
          <button onClick={() => handleAI('hintOnly')} className="bg-yellow-500 text-black px-3 py-1 rounded">
            💡 Hint Only
          </button>
          <button
            onClick={() => {
              const svg = document.querySelector('svg');
              if (svg) {
                lastInserted.current.forEach((node) => svg.removeChild(node));
                lastInserted.current = [];
                hintCounter.current = 0;
              }
            }}
            className="bg-red-500 text-white px-3 py-1 rounded"
          >
            🔙 Undo AI
          </button>
        </div>
      </div>
    </div>
  );
}
