import { useMemo, useState, useCallback } from "react";

/**
 * useGallery
 *
 * Consumes the manifest ({ pins, folders }) and returns:
 *  - flatItems: all media items in one ordered array
 *  - pins: the bookmark array for region navigation
 *  - activeIndex / setActiveIndex
 *  - navigate(dir): move by +1 / -1 with wrap
 *  - activeItem: the currently selected item
 */
export function useGallery(manifest) {
  // Guard: manifest may be null while the fetch is still in flight
  const folders = manifest?.folders ?? [];
  const pins = manifest?.pins ?? [];

  const flatItems = useMemo(
    () =>
      folders.flatMap((folder) =>
        folder.items.map((item) => ({
          ...item,
          folderKey: folder.folder,
        })),
      ),
    [folders],
  );

  const [activeIndex, setActiveIndex] = useState(0);

  const navigate = useCallback(
    (dir) => {
      setActiveIndex((prev) => {
        const next = prev + dir;
        if (next < 0) return flatItems.length - 1;
        if (next >= flatItems.length) return 0;
        return next;
      });
    },
    [flatItems.length],
  );

  const activeItem = flatItems[activeIndex] ?? null;

  return { flatItems, pins, activeIndex, setActiveIndex, navigate, activeItem };
}
