/* eslint-disable */
import {ZERO_ADDRESS} from './utils';
import {Transfer} from '../generated/ConquestToken/ConquestToken_Contract';
import {handleOwner, handleSpace, updateChainAndReturnTransactionID} from './shared';
import {Bytes} from '@graphprotocol/graph-ts';
import {Owner} from '../generated/schema';

export function handleTokenTransfer(event: Transfer): void {
  updateChainAndReturnTransactionID(event);
  let from: Owner | null;
  if (!event.params.from.equals(ZERO_ADDRESS)) {
    from = handleOwner(event.params.from);
    from.tokenBalance = from.tokenBalance.minus(event.params.value);
    from.save();
  }

  if (!event.params.to.equals(ZERO_ADDRESS)) {
    let to = handleOwner(event.params.to);
    to.tokenBalance = to.tokenBalance.plus(event.params.value);

    if (from) {
      if (!to.introducer) {
        to.introducer = from.id;
      }
    }

    let space = handleSpace();
    if (!(space.address && event.params.from.equals(space.address as Bytes))) {
      to.tokenGiven = to.tokenGiven.plus(event.params.value);
    }
    to.save();
  }
}
