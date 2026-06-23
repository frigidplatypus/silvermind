let editPage = $state('');
let editTitle = $state('');

export function setBuilderEdit(page: string, title: string) {
  editPage = page;
  editTitle = title;
}

export function getBuilderEdit() {
  return { page: editPage, title: editTitle };
}

export function clearBuilderEdit() {
  editPage = '';
  editTitle = '';
}
