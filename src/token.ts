/* eslint-disable */
import {ZERO_ADDRESS} from './utils';
import {Transfer} from '../generated/ConquestToken/ConquestToken_Contract';
import {handleOwner, updateChainAndReturnTransactionID} from './shared';
import {Bytes} from '@graphprotocol/graph-ts';
import {Owner} from '../generated/schema';

// TODO inject, for now use alpha address
let CONQUEST_ADDRESS: Bytes = Bytes.fromHexString('0x377606c34Ae6458d55ba04253ae815C9c48A9A73') as Bytes;

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

    if (!event.params.from.equals(CONQUEST_ADDRESS)) {
      to.tokenGiven = to.tokenGiven.plus(event.params.value);
    }
    to.save();
  }
}
