import {
    actorDataConverter,
    convertDistance, convertStringFromImperialToMetric,
    convertText,
    convertValueToMetric,
    labelConverter
} from "./ConversionEngineNew";
import {createErrorMessage} from "./ErrorHandler";
import {createNewCompendium, typeSelector} from "./Compendium5eConverter";
import Utils from "./Utils";

const itemUpdater = (item: any): void => {
    if (item.getFlag("Foundry-MGL", "converted")) return;
    const itemClone = JSON.parse(JSON.stringify(item));

    itemClone.data.description.value = convertText(itemClone.data.description.value);

    itemClone.data.target = convertDistance(itemClone.data.target);
    itemClone.data.range = convertDistance(itemClone.data.range);
    itemClone.data.weight = convertValueToMetric(itemClone.data.weight, 'pound');

    if (item.labels.range) item.labels.range = labelConverter(item.labels.range);


    item.setFlag("Foundry-MGL", "converted", true)
        .then(() => item.update(itemClone)
            .catch((e) => createErrorMessage(e, `${itemClone.name}.update`, itemClone)))
        .catch((e) => createErrorMessage(e, `${itemClone.name}.setFlag()`, item))
}

const itemsUpdater = (items: any[]): void => {
    for (const item of items) itemUpdater(item);
}

const actorUpdater = (actor: any): void => {
    const actorClone = JSON.parse(JSON.stringify(actor));

    actorClone.data = actorDataConverter(actorClone.data);

    actor.update(actorClone)
        .then(() => itemsUpdater(actor.items.entries))
        .catch((e) => createErrorMessage(e, 'actor.update', actorClone.data))
}

const journalUpdater = (journal: any): void => {
    const journalClone = JSON.parse(JSON.stringify(journal));

    journalClone.content = convertText(journalClone.content);

    journal.update(journalClone).catch((e) => createErrorMessage(e, journalClone.name, journal))
}

const sceneUpdater = (scene): void => {
    // @ts-ignore
    if (scene._view === true) return;
    const sceneClone = JSON.parse(JSON.stringify(scene));
    // @ts-ignore
    sceneClone.gridDistance = convertValueToMetric(sceneClone.gridDistance, sceneClone.gridUnits);
    // @ts-ignore
    sceneClone.gridUnits = convertStringFromImperialToMetric(sceneClone.gridUnits);

    scene.update(sceneClone).catch((e) => createErrorMessage(e, sceneClone.name, sceneClone));
}

const rollTableConverter = (rollTable: any): void => {
    const rollTableClone = JSON.parse(JSON.stringify(rollTable));

    rollTableClone.description = convertText(rollTableClone.description);
    rollTableClone.results.forEach((result) => {
        result.text = convertText(result.text)
    })

    rollTable.update(rollTableClone).catch((e) => createErrorMessage(e, rollTableClone.name, rollTableClone));
}

const compendiumConverter = (compendium: string): void => {
    const pack = game.packs.get(compendium);
    pack.getIndex()
        .then(() => createNewCompendium(pack.metadata)
            .then((newPack) => {
                const loadingCompendium = Utils.loading(`Converting compendium ${pack.metadata.label}`)(0)(pack.index.length - 1);
                for (const index of pack.index) {
                    pack.getEntity(index._id).then((entity) => {
                        let entityClone = JSON.parse(JSON.stringify(entity.data))
                        entityClone = typeSelector(entityClone, entity.constructor.name);
                        newPack.createEntity(entityClone)
                            .then(() => loadingCompendium())
                            .catch((e) => createErrorMessage(e, 'createNewEntity', entityClone));
                    }).catch((e) => createErrorMessage(e, 'getEntity', index._id))
                }
            }).catch((e) => createErrorMessage(e, 'createNewCompendium', pack.metadata)))
        .catch((e) => createErrorMessage(e, 'getIndex', pack))
}

const batchConversion = (elements: any[], callbackFunction) => {
    for (const elem of elements) callbackFunction(elem);
}

const initBatchConversion = (elements: any[], type: string) => () => {
    switch (type) {
        case 'compendium':
            return batchConversion(elements, compendiumConverter);
        case 'actors':
            return batchConversion(elements, actorUpdater);
        case 'items':
            return batchConversion(elements, itemUpdater);
        case 'tables':
            return batchConversion(elements, rollTableConverter);
        case 'journal':
            return batchConversion(elements, journalUpdater);
        case 'scenes':
            return batchConversion(elements, sceneUpdater);
    }
}

export {initBatchConversion}