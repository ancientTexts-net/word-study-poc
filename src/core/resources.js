import { get } from 'gitea-react-toolkit';
import YAML from 'js-yaml-parser';

export const CONFIG = {
  baseURL: 'https://git.door43.org/',
  verbose: true,
};
export const RESOURCES = [
  // { owner: 'unfoldingWord', lang: 'hbo', abbr: 'uhb' },
  { owner: 'unfoldingWord', lang: 'el-x-koine', abbr: 'ugnt' },
  { owner: 'unfoldingWord', lang: 'en', abbr: 'ult', tag: '25' },
  { owner: 'Door43-Catalog', lang: 'es-419', abbr: 'ulb' },
];

export const BOOKS = ['mat'];

export const importResources = async ({
  proskomma,
  books=BOOKS,
  onManifest,
  onImport,
  config=CONFIG,
  resources=RESOURCES,
  serialize=false,
}) => {
  await resources.forEach(async (resource, rI) => {
    const manifest = await getManifest({...resource, config});
    onManifest && onManifest({resource, manifest});
    const projects = projectsByBooks({manifest, books});
    await projects.forEach(async (project, pI) => {
      const { owner: org, lang, abbr } = resource;
      const selectors = { org, lang, abbr };

      const logId = `${rI}.${pI}`;

      let file;
      try { // fetch the file
        file = await getProjectFile({project, ...resource, config});
        config.verbose && console.log(`Fetched ${logId}`, selectors, project);
      } catch (e) {
        config.verbose && console.log(`Failed to Fetch ${logId}`, selectors, project, e);
      };

      try { // import the file
        const result = await proskomma.importDocuments(selectors, "usfm", [file], {});
        config.verbose && console.log(`Imported ${logId}`, selectors, project, result);
        onImport();
      } catch (e) {
        console.log(`Failed to Import ${logId}`, selectors, project, e);
      };
    });
  });
};

export const importResource = async ({
  proskomma,
  book,
  config=CONFIG,
  resource,
}) => {
  const manifest = await getManifest({...resource, config});
  const projects = projectsByBooks({manifest, books: [book]});
  const project = projects[0];
  const { owner: org, lang, abbr } = resource;
  const selectors = { org, lang, abbr };

  let file;
  try { // fetch the file
    file = await getProjectFile({project, ...resource, config});
    config.verbose && console.log(`Fetched`, selectors, project);
  } catch (e) {
    config.verbose && console.log(`Failed to Fetch`, selectors, project, e);
  };

  let result;
  try { // import the file
    result = await proskomma.importDocuments(selectors, "usfm", [file], {});
    config.verbose && console.log(`Imported`, selectors, project, result);
  } catch (e) {
    console.log(`Failed to Import`, selectors, project, e);
  };
  return result;
};

const getReleasePath = ({ owner, lang, abbr, tag, branch='master' }) => {
  const release = tag ? `tag/${tag}` : `branch/${branch}`;
  const releasePath = `/${owner}/${lang}_${abbr}/raw/${release}`;
  return releasePath;
}

export const getProjectFile = async ({ project, owner, lang, abbr, tag, branch, config }) => {
  // if no tag, do not cache, master branch is assumed
  const releasePath = getReleasePath({owner, lang, abbr, tag, branch});
  const url = `${releasePath}/${project.path}`;
  const response = await get({ url, config });
  return response;
};

export const getManifest = async ({ owner, lang, abbr, tag, branch, config=CONFIG }) => {
  // if no tag, do not cache, master branch is assumed
  const releasePath = getReleasePath({owner, lang, abbr, tag, branch});
  const url = `${releasePath}/manifest.yaml`;
  const response = await get({ url, config });
  const manifest = YAML.safeLoad(response);
  return manifest;
};

export const projectsByBooks = ({manifest, books}) => {
  let {projects} = manifest;
  if (books && books.length > 0) {
    projects = manifest.projects.filter(project => (
      books.map(book => book.toUpperCase())
      .includes(project.identifier.toUpperCase())
    ));
  };
  return projects;
};