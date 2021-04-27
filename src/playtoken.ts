/* eslint-disable */
import {ZERO_ADDRESS} from './utils';
import {Transfer} from '../generated/PlayToken_L2/PlayToken_L2_Contract';
import {handleOwner} from './shared';

export function handlePlayTokenTransfer(event: Transfer): void {
  if (!event.params.from.equals(ZERO_ADDRESS)) {
    let from = handleOwner(event.params.from);
    from.playTokenBalance = from.playTokenBalance.minus(event.params.value);
    from.save();
  }

  if (!event.params.to.equals(ZERO_ADDRESS)) {
    let to = handleOwner(event.params.to);
    to.playTokenBalance = to.playTokenBalance.plus(event.params.value);
    to.save();
  }
}
