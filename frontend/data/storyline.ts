// data/storyline.ts
export const mergeListStoryline = [
  {
    step: 1,
    title: 'Draw Input Lists',
    hint: 'Draw the two input sorted linked lists:\nlist1 = [1,2,4], list2 = [1,3,4]',
  },
  {
    step: 2,
    title: 'Compare First Nodes',
    hint: 'Compare the head nodes: list1[0] = 1 and list2[0] = 1. Pick one to start merged list.',
  },
  {
    step: 3,
    title: 'Add Smaller Node to Merged List',
    hint: 'Add node 1 (from list1) to the merged list.',
  },
  {
    step: 4,
    title: 'Advance in list1',
    hint: 'Move to the next node in list1 and compare again.',
  },
  {
    step: 5,
    title: 'Repeat Until One List is Empty',
    hint: 'Continue merging by choosing the smaller node.',
  },
  {
    step: 6,
    title: 'Attach Remaining List',
    hint: 'Attach remaining nodes directly when one list is exhausted.',
  },
  {
    step: 7,
    title: 'Show Final Merged List',
    hint: 'The final merged list is [1,1,2,3,4,4]. Draw it completely.',
  },
]
