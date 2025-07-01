
/**
 * @file screen-attribute-trees.ts
 * @copyright 2021 - 2024, Firaxis Games
 * @description Shows a player's Attribute stats and points, and lets them spend points on Attribute skills
 */
import AttributeTrees from './model-attribute-trees.js';
import { InputEngineEventName } from '/core/ui/input/input-support.js';
import NavTray from '/core/ui/navigation-tray/model-navigation-tray.js';
import Panel from '/core/ui/panel-support.js';
import Databind from '/core/ui/utilities/utilities-core-databinding.js';
import { MustGetElement } from '/core/ui/utilities/utilities-dom.js';
import { TreeSupport, UpdateLinesEvent, TreeGridDirection } from '/base-standard/ui/tree-grid/tree-support.js';
import { TreeCardHoveredEventName } from '/base-standard/ui/tree-grid/tree-card.js';
import FocusManager from '/core/ui/input/focus-manager.js';
class ScreenIdentity extends Panel {
    constructor() {
        super(...arguments);
        this.currentPanelIndex = 0;
        this.currentPanelID = "";
        this.closeButtonListener = () => { this.close(); };
        this.engineInputListener = (inputEvent) => { this.onEngineInput(inputEvent); };
        this.resizeListener = this.onResize.bind(this);
        this.onCardHoverListener = this.onCardHover.bind(this);
        this.attributeTabBar = document.createElement("fxs-tab-bar");
        this.panelContentElements = new Map();
        this.onTabBarSelected = (event) => {
            this.currentPanelIndex = event.detail.index;
            this.currentPanelID = event.detail.selectedItem.id;
            this.ensurePanelContent(this.currentPanelIndex, this.currentPanelID);
            this.refreshDetailsPanel(AttributeTrees.getFirstAvailable(this.currentPanelID));
            this.attributeSlotGroup.setAttribute("selected-slot", event.detail.selectedItem.id);
            const panelContent = this.panelContentElements.get(this.currentPanelIndex);
            const linesContainer = panelContent?.root?.querySelector('.lines-container');
            linesContainer?.dispatchEvent(new UpdateLinesEvent());
        };
    }
    get treeDetail() {
        return this._treeDetail ?? (this._treeDetail = document.createElement("tree-detail"));
    }
    onInitialize() {
        super.onInitialize();
        this.enableOpenSound = true;
        this.enableCloseSound = true;
        this.Root.setAttribute("data-audio-group-ref", "audio-diplo-project-reaction");
    }
    onAttach() {
        super.onAttach();
        this.frame = MustGetElement('#attribute-trees-frame', this.Root);
        this.frame.setAttribute("box-style", TreeSupport.isSmallScreen() ? "fullscreen" : "b1");
        this.tabContainerElement = MustGetElement('#attribute-tab-container', this.Root);
        this.header = MustGetElement(".attribute-trees__header", this.Root);
        this.header.setAttribute("filigree-style", TreeSupport.isSmallScreen() ? "none" : "h3");
        const tabControl = this.createTabControl();
        this.tabContainerElement.appendChild(tabControl);
        this.frame.addEventListener('subsystem-frame-close', this.closeButtonListener);
        window.addEventListener(InputEngineEventName, this.engineInputListener);
        window.addEventListener('resize', this.resizeListener);
        engine.on('AttributePointsChanged', this.refreshAll, this);
        engine.on('AttributeNodeCompleted', this.refreshAll, this);
        this.refreshAll();
    }
    onDetach() {
        engine.off('AttributePointsChanged', this.refreshAll, this);
        engine.off('AttributeNodeCompleted', this.refreshAll, this);
        window.removeEventListener('resize', this.resizeListener);
        window.removeEventListener(InputEngineEventName, this.engineInputListener);
        this.frame.removeEventListener('subsystem-frame-close', this.closeButtonListener);
        super.onDetach();
    }
    onReceiveFocus() {
        super.onReceiveFocus();
        waitForLayout(() => FocusManager.setFocus(this.attributeSlotGroup));
        NavTray.clear();
        NavTray.addOrUpdateGenericBack();
    }
    onLoseFocus() {
        NavTray.clear();
        super.onLoseFocus();
    }
    onEngineInput(inputEvent) {
        if (inputEvent.detail.status != InputActionStatuses.FINISH) {
            return;
        }
        if (inputEvent.isCancelInput() || inputEvent.detail.name == 'sys-menu') {
            this.close();
            inputEvent.stopPropagation();
            inputEvent.preventDefault();
        }
    }
    refreshAll() {
        AttributeTrees.updateGate.call("refreshAll");
        // wait until all values are displayed
        waitForLayout(() => this.updateTabControl());
    }
    /**
     * @returns: A tab control element configured with an array of tab configuration objects
    */
    createTabControl() {
        const configuration = this.getConfigurationTabArray();
        const attributeTabContainer = document.createElement("div");
        attributeTabContainer.classList.add("px-10", "flex", "flex-auto", "justify-center");
        this.attributeTabBar.setAttribute("tab-for", "fxs-subsystem-frame");
        this.attributeTabBar.setAttribute("tab-items", JSON.stringify(configuration));
        this.attributeTabBar.setAttribute("data-audio-focus-ref", "none");
        this.attributeTabBar.classList.add("max-w-full");
        this.attributeTabBar.addEventListener("tab-selected", this.onTabBarSelected);
        this.attributeSlotGroup = document.createElement("fxs-slot-group");
        this.attributeSlotGroup.classList.add("flex", "flex-auto");
        const content = document.createElement("div");
        content.classList.add("flex-auto", "flex", "flex-col");
        content.appendChild(this.attributeSlotGroup);
        this.ensurePanelContent(0, configuration[0].id);
        const frag = document.createDocumentFragment();
        attributeTabContainer.appendChild(this.attributeTabBar);
        frag.appendChild(attributeTabContainer);
        frag.appendChild(content);
        return frag;
    }
    ensurePanelContent(index, id) {
        if (!this.panelContentElements.has(index)) {
            const panelCategoryContainer = document.createElement("fxs-slot");
            panelCategoryContainer.classList.add("flex-auto", "items-center", "flex-col", "w-full", "relative");
            panelCategoryContainer.setAttribute("tabindex", "-1");
            panelCategoryContainer.setAttribute("id", id);
            this.createPanelContent(panelCategoryContainer, index, id);
            this.attributeSlotGroup.appendChild(panelCategoryContainer);
        }
        else {
            const cardDetailContainer = this.panelContentElements.get(index)?.cardDetailContainer;
            cardDetailContainer?.classList.toggle("flex", TreeSupport.isSmallScreen());
            cardDetailContainer?.classList.toggle("hidden", !TreeSupport.isSmallScreen());
        }
    }
    updateTabControl() {
        const configuration = this.getConfigurationTabArray();
        const currentPanelIndex = this.currentPanelIndex;
        this.attributeTabBar.setAttribute("tab-items", JSON.stringify(configuration));
        this.attributeTabBar.setAttribute("selected-tab-index", currentPanelIndex.toString());
    }
    /**
     * @returns: An array containing tab configuration object to create tabs in an easier way
    */
    getConfigurationTabArray() {
        const configuration = [];
        for (const a of AttributeTrees.attributes) {
            console.log(`hacker: ` + JSON.stringify(a))
            const definition = GameInfo.Attributes.lookup(a.type);
            const iconURL = UI.getIconURL(a.type.toString(), "ATTRIBUTE");
            const hasTree = a.treeGrid != undefined;
            if (!definition) {
                console.warn("screen-attribute-trees: getConfigurationTabArray(): No definition for attribute: " + a.type);
                continue;
            }
            if (!hasTree) {
                console.warn("screen-attribute-trees: getConfigurationTabArray(): No tree definition for attribute: " + a.type);
                continue;
            }
            const name = Locale.compose(definition.Name || "LOC_UI_ATTRIBUTE_TREES_TITLE");
            configuration.push({
                id: definition?.AttributeType || "no_type",
                label: `${TreeSupport.isSmallScreen() ? "" : name} ${a.availablePoints}`,
                className: "mx-4 w-60",
                labelClass: `flex-auto font-fit-shrink whitespace-nowrap ${TreeSupport.isSmallScreen() ? "grow-0" : ""}`,
                icon: iconURL,
                iconClass: "size-8 mr-2"
            });
        }
        return configuration;
    }
    createPanelContent(container, index, id) {
        const attribute = `g_AttributeTrees.attributes[${index}]`;
        const wildcardElement = document.createElement('div');
        wildcardElement.classList.add("my-5", "font-body", "text-base");
        Databind.html(wildcardElement, `${attribute}.wildCardLabel`);
        const treeContent = document.createElement('div');
        treeContent.classList.add("flex", "flex-auto", "flex-col", "items-center", "w-full");
        treeContent.classList.toggle("mb-4", !TreeSupport.isSmallScreen());
        const treeDetails = document.createElement('div');
        treeDetails.classList.add("flex", "flex-auto", "w-full");
        const scrollable = TreeSupport.getGridElement(attribute, TreeGridDirection.VERTICAL, this.createCard.bind(this));
        if (TreeSupport.isSmallScreen()) {
            scrollable.setAttribute('handle-gamepad-pan', 'false');
        }
        const cardDetailContainer = document.createElement("div");
        cardDetailContainer.classList.add("screen-attribute__card-container", "ml-5", "mr-2", "pointer-events-none", "items-end", "w-96", "flex");
        cardDetailContainer.classList.toggle("flex", TreeSupport.isSmallScreen());
        cardDetailContainer.classList.toggle("hidden", !TreeSupport.isSmallScreen());
        cardDetailContainer.setAttribute('panel-id', id);
        treeDetails.append(scrollable, cardDetailContainer);
        treeContent.append(wildcardElement, treeDetails);
        this.panelContentElements.set(index, {
            root: treeContent,
            scrollable,
            cardDetailContainer
        });
        container.appendChild(treeContent);
    }
    createCard(container) {
        const cardElement = document.createElement("attribute-card");
        cardElement.classList.add("mx-6");
        Databind.if(cardElement, "card.isContent");
        Databind.attribute(cardElement, 'dummy', 'card.isDummy');
        Databind.attribute(cardElement, 'type', 'card.nodeType');
        Databind.attribute(cardElement, "name", "card.name");
        Databind.attribute(cardElement, "disabled", "card.isLocked");
        Databind.attribute(cardElement, "completed", "card.isCompleted");
        Databind.attribute(cardElement, "repeatable", "card.isRepeatable");
        Databind.attribute(cardElement, "repeated", "card.repeatedDepth");
        Databind.attribute(cardElement, "icon", "card.icon");
        Databind.classToggle(cardElement, "attribute-card--repeatable", "card.isRepeatable");
        Databind.classToggle(cardElement, "attribute-card--complete", "card.isCompleted");
        Databind.classToggle(cardElement, "attribute-card--in-progress", "card.isCurrentlyActive");
        Databind.classToggle(cardElement, "available", "card.isAvailable");
        cardElement.addEventListener(TreeCardHoveredEventName, this.onCardHoverListener);
        container.appendChild(cardElement);
    }
    refreshDetailsPanel(nodeId, level = "0") {
        const node = AttributeTrees.getCard(nodeId);
        if (node == undefined) {
            console.error("screen-attribute-tree: refreshDetailsPanel(): Node with id " + nodeId + " couldn't be found on the grid data");
            return;
        }
        this.selectedNode = nodeId;
        this.updateTreeDetail(nodeId, level);
        const selectedElement = this.Root.querySelector(`attribute-card[type="${this.selectedNode}"]`);
        selectedElement?.classList.add("selected");
        const canActivateItem = this.selectedNode ? AttributeTrees.canBuyAttributeTreeNode(this.selectedNode) : false;
        selectedElement?.setAttribute("play-error-sound", (!canActivateItem).toString());
        this.refreshNavTray(canActivateItem);
    }
    updateTreeDetail(nodeId, level) {
        if (!TreeSupport.isSmallScreen()) {
            return;
        }
        const panelContent = this.panelContentElements.get(this.currentPanelIndex);
        if (!panelContent) {
            console.error("screen-attribute-tree: refreshDetailsPanel(): could not get panelContent for currentPanelIndex: " + this.currentPanelIndex);
            return;
        }
        const { root, cardDetailContainer } = panelContent;
        if (!cardDetailContainer.contains(this.treeDetail)) {
            cardDetailContainer.appendChild(this.treeDetail);
            // The tree detail scrollable never receives focus directly, so we need to make the scrollable listen for engine input
            // at the root of the panel content
            waitForLayout(() => {
                const treeDetailScrollable = this.treeDetail.maybeComponent?.scrollable?.maybeComponent;
                treeDetailScrollable?.setEngineInputProxy(root);
            });
        }
        const node = AttributeTrees.getCard(nodeId);
        if (node == undefined) {
            console.error("screen-attribute-tree: refreshDetailsPanel(): Node with id " + nodeId + " couldn't be found on the grid data");
            return;
        }
        const definition = GameInfo.Attributes.lookup(this.currentPanelID);
        this.treeDetail.setAttribute('detailed', "true");
        this.treeDetail.setAttribute('type', node.nodeType.toString());
        this.treeDetail.setAttribute('name', Locale.compose(definition?.Name || "LOC_UI_ATTRIBUTE_TREES_TITLE"));
        this.treeDetail.setAttribute('description', Locale.compose(definition?.Description || ""));
        this.treeDetail.setAttribute('level', level);
        this.treeDetail.setAttribute('progress', `${node.progressPercentage}`);
        this.treeDetail.setAttribute('turns', `${node.turns}`);
        this.treeDetail.setAttribute('unlocks-by-depth', node.unlocksByDepthString);
        this.treeDetail.setAttribute('icon', node.icon);
        this.treeDetail.setAttribute('repeated', `${node.repeatedDepth}`);
    }
    refreshNavTray(canActivateItem) {
        NavTray.addOrUpdateGenericBack();
        if (canActivateItem) {
            NavTray.addOrUpdateAccept('LOC_UI_ATTRIBUTE_TREES_BUY_BUTTON');
        }
        else {
            NavTray.removeAccept();
        }
    }
    onResize() {
        const panelContent = this.panelContentElements.get(this.currentPanelIndex);
        const linesContainer = panelContent?.root?.querySelector('.lines-container');
        linesContainer?.dispatchEvent(new UpdateLinesEvent());
        this.updateTabControl();
        panelContent?.cardDetailContainer.classList.toggle("flex", TreeSupport.isSmallScreen());
        panelContent?.cardDetailContainer.classList.toggle("hidden", !TreeSupport.isSmallScreen());
        panelContent?.root.classList.toggle("mb-4", !TreeSupport.isSmallScreen());
        for (const { scrollable } of this.panelContentElements.values()) {
            if (TreeSupport.isSmallScreen()) {
                this.frame.setAttribute("box-style", "fullscreen");
                this.header.setAttribute("filigree-style", "none");
                this.cardDetailContainer?.classList.remove("hidden");
                this.cardDetailContainer?.classList.add("flex");
                // disable gamepad pan on the main scrollable so that we can use it for the tree detail
                scrollable.setAttribute('handle-gamepad-pan', 'false');
            }
            else {
                this.frame.setAttribute("box-style", "b1");
                this.header.setAttribute("filigree-style", "h3");
                this.cardDetailContainer?.classList.remove("flex");
                this.cardDetailContainer?.classList.add("hidden");
                scrollable.setAttribute('handle-gamepad-pan', 'true');
            }
        }
    }
    onCardHover(event) {
        this.refreshDetailsPanel(event.detail.type, event.detail.level);
    }
    close() {
        AttributeTrees.activeTreeAttribute = null;
        const result = Game.PlayerOperations.canStart(GameContext.localPlayerID, PlayerOperationTypes.CONSIDER_ASSIGN_ATTRIBUTE, {}, false);
        if (!result) {
            console.error("screen-attribute-tree: close(): The operation PlayerOperationTypes.CONSIDER_ASSIGN_ATTRIBUTE resulted in a undefined behavior");
            super.close();
            return;
        }
        if (result.Success) {
            Game.PlayerOperations.sendRequest(GameContext.localPlayerID, PlayerOperationTypes.CONSIDER_ASSIGN_ATTRIBUTE, {});
        }
        super.close();
    }
}
Controls.define('screen-attribute-trees', {
    createInstance: ScreenIdentity,
    description: 'Area for player Attribute stats, points, and skill trees.',
    classNames: ['screen-attribute-trees', 'absolute', 'flex-auto', 'inset-0', 'pointer-events-auto'],
    styles: ["fs://game/base-standard/ui/attribute-trees/screen-attribute-trees.css"],
    content: ['fs://game/base-standard/ui/attribute-trees/screen-attribute-trees.html']
});

//# sourceMappingURL=file:///base-standard/ui/attribute-trees/screen-attribute-trees.js.map
