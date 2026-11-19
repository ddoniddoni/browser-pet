import { t } from '../../../shared/i18n';
import { menuIcon } from './menu-icon';

export function createAgendaTools() {
  const group=document.createElement('div');
  group.className='pet-agenda-tools';
  const manage=document.createElement('button');
  manage.type='button';
  manage.title=t('agendaWindowName');
  manage.append(menuIcon('bell'),document.createTextNode(t('agendaManage')),menuIcon('forward'));
  group.append(manage);
  return {group,manage};
}
