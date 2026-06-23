let editPage = $state('');
let editTitle = $state('');
let editBlockNumber = $state(0);

export function setBuilderEdit(page: string, title: string, blockNumber: number) {
  editPage = page;
  editTitle = title;
  editBlockNumber = blockNumber;
}

export function getBuilderEdit() {
  return { page: editPage, title: editTitle, blockNumber: editBlockNumber };
}

export function clearBuilderEdit() {
  editPage = '';
  editTitle = '';
  editBlockNumber = 0;
}
