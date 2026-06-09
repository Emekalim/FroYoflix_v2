import Debug from "debug";

import { toTS } from "@/modules/util.js";

const debug = Debug("ui:player");

// generates seekbar hover thumbnails by seeking a hidden video element
// through the buffered range; getBuffer reports the torrent download
// percentage so generation can wait for data to arrive
export function createThumbnailer({ getBuffer }) {
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = 200;
  const thumbnailData = {
    thumbnails: [],
    canvas: thumbCanvas,
    context: thumbCanvas.getContext("2d"),
    interval: null,
    video: null,
  };
  let thumbnailProcess = null;

  function getThumbnail(percent, duration) {
    return (
      thumbnailData.thumbnails[
        Math.floor(((percent / 100) * duration) / thumbnailData.interval)
      ] || " "
    );
  }

  function captureCurrentFrame(vid) {
    if (vid?.readyState >= 2) {
      const index = Math.floor(vid.currentTime / thumbnailData.interval);
      if (!thumbnailData.thumbnails[index]) {
        thumbnailData.context.fillRect(0, 0, 200, thumbnailData.canvas.height);
        thumbnailData.context.drawImage(
          vid,
          0,
          0,
          200,
          thumbnailData.canvas.height,
        );
        thumbnailData.thumbnails[index] =
          thumbnailData.canvas.toDataURL("image/jpeg");
      }
    }
  }

  function init({ videoWidth, videoHeight, duration, url }) {
    const height = 200 / (videoWidth / videoHeight);
    if (!isNaN(height)) {
      thumbnailData.interval = duration / 300 < 5 ? 5 : duration / 300;
      thumbnailData.canvas.height = height;
      generateThumbnails(url);
    }
  }

  async function generateThumbnails(url) {
    debug("Starting thumbnail generation...");
    if (thumbnailProcess && thumbnailProcess.running) {
      debug(
        "Detected a currently running thumbnail generation process, interrupting...",
      );
      thumbnailProcess.videoDraw.remove();
      thumbnailProcess.running = false;
      await new Promise((resolve) => setTimeout(resolve, 5 * 1_000));
    }
    const t0 = performance.now();
    thumbnailProcess = {
      videoDraw: document.createElement("video"),
      running: true,
    };
    const videoDraw = thumbnailProcess.videoDraw;
    videoDraw.src = url;
    videoDraw.preload = "auto";
    videoDraw.volume = 0;
    videoDraw.playbackRate = 0;
    videoDraw.onloadeddata = () => {
      let index = 0;
      let lastIndex = 0;
      function captureThumbnail() {
        if (!thumbnailProcess.running) {
          debug(
            "Thumbnail generation process was interrupted due to a change in the video url, exiting...",
          );
          return;
        }
        const buffer = getBuffer();
        let dynamicDuration = (buffer / 100) * videoDraw.duration;
        if (!isFinite(dynamicDuration)) {
          debug("Video is still loading... waiting to generate thumbnails...");
          setTimeout(() => captureThumbnail(), 1_000);
          return;
        }
        while (thumbnailData.thumbnails[index]) index++;
        const currentTime = index * thumbnailData.interval;
        if (
          currentTime >= dynamicDuration &&
          currentTime < videoDraw.duration
        ) {
          if (lastIndex !== index) {
            lastIndex = index;
            debug(
              `Reached currently downloaded video duration, current seek time is: ${currentTime}s (${index} of ${buffer}%), waiting for buffer update...`,
            );
          }
          setTimeout(() => {
            if (currentTime < (getBuffer() / 100) * videoDraw.duration) {
              lastIndex = 0;
              debug(
                "Detected a buffer change, continuing thumbnail generation...",
              );
            }
            captureThumbnail();
          }, 1_000);
          return;
        }

        if (currentTime >= videoDraw.duration) {
          debug(
            "Thumbnail generation has successfully completed, took:",
            toTS((performance.now() - t0) / 1_000),
          );
          videoDraw.remove();
          return;
        } else if (
          isFinite(currentTime) &&
          currentTime >= 0 &&
          currentTime <= dynamicDuration
        ) {
          videoDraw.currentTime = currentTime;
        } else {
          debug(
            "Something went wrong calculating the current time for the thumbnails video, calculated:",
            currentTime,
            dynamicDuration,
            getBuffer(),
          );
          return;
        }

        videoDraw.onseeked = () => {
          if (!thumbnailProcess.running) {
            debug(
              "Thumbnail generation process was interrupted due to a change in the video url, exiting...",
            );
            return;
          }
          thumbnailData.context.fillRect(
            0,
            0,
            200,
            thumbnailData.canvas.height,
          );
          thumbnailData.context.drawImage(
            videoDraw,
            0,
            0,
            200,
            thumbnailData.canvas.height,
          );
          thumbnailData.thumbnails[index] =
            thumbnailData.canvas.toDataURL("image/jpeg");
          captureThumbnail();
        };
      }
      captureThumbnail();
    };
    videoDraw.onerror = (e) => {
      debug("Error loading video for thumbnail generation:", e);
      videoDraw.remove();
    };
  }

  function reset(revokeSrc) {
    if (thumbnailData.video?.src) URL.revokeObjectURL(revokeSrc);
    Object.assign(thumbnailData, {
      thumbnails: [],
      interval: undefined,
      video: undefined,
    });
  }

  return { getThumbnail, captureCurrentFrame, init, reset };
}
