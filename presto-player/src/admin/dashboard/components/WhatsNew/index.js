const { __ } = wp.i18n;
import useWhatsNewRSS from "./useWhatsNewRSS";

const WhatsNewRSS = () => {
  // Initialize library's custom hook.
  useWhatsNewRSS({
    uniqueKey: "presto-player",
    rssFeedURL: "https://prestoplayer.com/whats-new/feed/",
    selector: "#whats-new-container",
    flyout: {
      title: __("What's New?", "presto-player"),
      className: "presto-player-whats-new-flyout",
      innerContent: {
        titleLink: false,
      },
      // The library's default excerpt truncates posts to 500 words by
      // stripping every HTML tag and joining the remaining words with
      // spaces — which flattens headings, paragraphs, and lists into a
      // single wall of text. Setting wordLimit=0 short-circuits that
      // path so the raw post HTML reaches the flyout intact (the
      // library's own CSS already styles h2/h3/p/ul/ol inside the
      // content area).
      excerpt: {
        wordLimit: 0,
      },
    },
  });

  return <div id="whats-new-container"></div>;
};

export default WhatsNewRSS;
