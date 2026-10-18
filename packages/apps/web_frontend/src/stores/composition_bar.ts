import { reactive } from "vue";

/** The composition bar under the focused pane: the images and the text that wait to be sent to the focused pane. */
export const compositionBar = reactive<{
  /** True while the composition bar is open under the focused pane. A drop of images opens it. */
  isOpen: boolean;
  /** Absolute paths of the image files, in the order in which they were added. */
  paths: string[];
  /** The text that the developer typed, sent after the images. */
  text: string;
  /** Small picture of each image file as a `data:` address, by path. An empty text means that the picture could not be made. */
  thumbnails: Record<string, string>;
  /** Large picture of each image file that the big view has shown, as a `data:` address, by path. */
  previews: Record<string, string>;
  /** The position, in `paths`, of the image that the big view shows, or null when the big view is closed. */
  viewerIndex: number | null;
}>({
  isOpen: false,
  paths: [],
  text: "",
  thumbnails: {},
  previews: {},
  viewerIndex: null,
});
