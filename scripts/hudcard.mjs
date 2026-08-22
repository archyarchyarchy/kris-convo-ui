/**
 * Builds a ".hud-card" element: the image/banner/side-button portrait card
 * shared by the party HUD, the conversation speaker panel, and the
 * conversation participant panels. Each of those has its own mix of sizing,
 * click behaviour and buttons, so this only builds the DOM skeleton -- click
 * handlers, dim/highlight state, etc. are all passed in per-card.
 *
 * @param {object} options
 * @param {number|string} [options.width] - CSS width; a number is treated as px.
 * @param {number|string} [options.height] - CSS height; a number is treated as px.
 * @param {string} [options.aspectRatio] - CSS aspect-ratio, used instead of a fixed height.
 * @param {boolean} [options.showImage=true] - Whether to render the image area at all.
 * @param {string} [options.image] - Image URL. If falsy, placeholderText is shown instead.
 * @param {string} [options.placeholderText] - Text shown when showImage is true but image is falsy.
 * @param {string} [options.name] - Used as the image alt text and the banner text.
 * @param {boolean} [options.showBanner=true] - Whether to render the name banner.
 * @param {boolean} [options.dimmed=false] - Adds the convoui-npc-dim class.
 * @param {boolean} [options.highlighted=false] - Adds the hud-card-highlight class.
 * @param {object} [options.dataset={}] - Extra data-* attributes to set on the card.
 * @param {function} [options.onImageClick] - Click handler for the image area.
 * @param {function} [options.onBannerClick] - Click handler for the name banner.
 * @param {{iconClass: string, onClick: function}} [options.sideButton] - Optional
 *   corner button (e.g. the hide/reveal eye icon). Presence of this option also
 *   sets position:relative/overflow:visible on the card so the button can hover
 *   at its edge.
 * @returns {HTMLDivElement} The card element, not yet attached to the DOM.
 */
export function buildHudCard({
    width,
    height,
    aspectRatio,
    showImage = true,
    image,
    placeholderText,
    name,
    showBanner = true,
    dimmed = false,
    highlighted = false,
    dataset = {},
    onImageClick = null,
    onBannerClick = null,
    sideButton = null
} = {}) {
    const card = document.createElement("div");
    card.className = "hud-card";

    if (width != null) card.style.width = typeof width === "number" ? `${width}px` : width;
    if (height != null) card.style.height = typeof height === "number" ? `${height}px` : height;
    if (aspectRatio) card.style.aspectRatio = aspectRatio;

    if (dimmed) card.classList.add("convoui-npc-dim");
    if (highlighted) card.classList.add("hud-card-highlight");

    for (const [key, value] of Object.entries(dataset)) {
        card.dataset[key] = value;
    }

    if (showImage) {
        const imageCard = document.createElement("div");
        imageCard.className = "hud-card-main";
        if (onImageClick) imageCard.addEventListener("click", onImageClick);

        if (image) {
            const imgElement = document.createElement("img");
            imgElement.src = image;
            imgElement.alt = name ?? "";
            imageCard.appendChild(imgElement);
        } else if (placeholderText) {
            const placeholder = document.createElement("div");
            placeholder.classList.add("hud-card-empty");
            placeholder.textContent = placeholderText;
            imageCard.appendChild(placeholder);
        }

        card.appendChild(imageCard);
    }

    if (showBanner) {
        const banner = document.createElement("div");
        banner.classList.add("hud-card-banner");
        banner.textContent = name ?? "";
        if (onBannerClick) banner.addEventListener("click", onBannerClick);
        card.appendChild(banner);
    }

    if (sideButton) {
        card.style.position = "relative";
        card.style.overflow = "visible";

        const btn = document.createElement("div");
        btn.classList.add("hud-card-sidebtn");

        const icon = document.createElement("i");
        icon.classList.add("fas", sideButton.iconClass);
        btn.appendChild(icon);

        btn.addEventListener("click", sideButton.onClick);
        card.appendChild(btn);
    }

    return card;
}
