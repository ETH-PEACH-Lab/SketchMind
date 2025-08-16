import { nanoid } from "nanoid";

export async function injectSvgImagesAsLibraryItems(excalidrawAPI: any, urls: string[]) {
  const items = [];

  for (const url of urls) {
    const fileId = nanoid();
    const name = url.split("/").pop()?.replace(".svg", "") || "image";

    const response = await fetch(url);
    const blob = await response.blob();
    const dataURL = await blobToDataURL(blob);

    // Step 1: inject into file store
    excalidrawAPI.addFiles({
      [fileId]: {
        id: fileId,
        dataURL,
        mimeType: "image/svg+xml",
        created: Date.now(),
        lastRetrieved: Date.now(),
      },
    });

    // Step 2: build library item
    items.push({
      id: nanoid(),
      status: "published",
      created: Date.now(),
      name,
      elements: [
        {
          type: "image",
          version: 1,
          versionNonce: Math.floor(Math.random() * 100000),
          isDeleted: false,
          id: nanoid(),
          fileId,
          x: 0,
          y: 0,
          width: 300,
          height: 200,
          angle: 0,
          opacity: 100,
          status: "saved",
          scale: [1, 1],
          seed: Math.floor(Math.random() * 100000),
        },
      ],
    });
  }

  // Step 3: inject all items into library
  excalidrawAPI.updateLibrary({
    libraryItems: items,
    openLibraryMenu: true,
  });
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
