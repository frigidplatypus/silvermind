let editPage = $state('');
let editTitle = $state('');
let editBlockNumber = $state(0);
let editSLIQ = $state('');

export function setBuilderEdit(page: string, title: string, blockNumber: number, sliq?: string) {
  editPage = page;
  editTitle = title;
  editBlockNumber = blockNumber;
  editSLIQ = sliq ?? '';
}

export function getBuilderEdit() {
  return { page: editPage, title: editTitle, blockNumber: editBlockNumber, sliq: editSLIQ };
}

export function clearBuilderEdit() {
  editPage = '';
  editTitle = '';
  editBlockNumber = 0;
  editSLIQ = '';
}
