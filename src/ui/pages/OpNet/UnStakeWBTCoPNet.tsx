import BigNumber from 'bignumber.js';
import { getContract, IWBTCContract, WBTC_ABI } from 'opnet';
import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Account, OPTokenInfo } from '@/shared/types';
import { addressShortner } from '@/shared/utils';
import Web3API, { bigIntToDecimal } from '@/shared/web3/Web3API';
import { Button, Content, Header, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useCurrentKeyring } from '@/ui/state/keyrings/hooks';
import { useWallet } from '@/ui/utils';
import { Address } from '@btc-vision/transaction';

import { RouteTypes, useNavigate } from '../MainRoute';

interface ItemData {
    key: string;
    account?: Account;
}

export default function UnWrapBitcoinOpnet() {
    const { state } = useLocation();
    const props = state as {
        OpNetBalance: OPTokenInfo;
    };

    const OpNetBalance = props.OpNetBalance;
    const account = useCurrentAccount();

    const navigate = useNavigate();
    const [inputAmount, setInputAmount] = useState('');
    const [disabled, setDisabled] = useState(true);

    const [OpnetRateInputVal, adjustFeeRateInput] = useState('5000');
    const [stakedReward, setStakeReward] = useState<bigint>(0n);
    const [stakedAmount, setStakedAmount] = useState<bigint>(0n);
    const [totalStaked, setTotalStaked] = useState<bigint>(0n);
    const [rewardPool, setRewardPool] = useState<bigint>(0n);

    const wallet = useWallet();

    const [availableBalance, setAvailableBalance] = useState('0');
    const [error, setError] = useState('');

    const $style = { maxWidth: '350px', marginRight: 'auto', marginLeft: 'auto', width: '100%' } as CSSProperties;

    const tools = useTools();
    useEffect(() => {
        const setWallet = async () => {
            Web3API.setNetwork(await wallet.getChainType());

            if (!Web3API.WBTC) {
                tools.toastError('Error in getting WBTC contract');
                return;
            }

            const walletAddressPub = Address.fromString(account.pubkey);

            const contract: IWBTCContract = getContract<IWBTCContract>(
                Web3API.WBTC,
                WBTC_ABI,
                Web3API.provider,
                Web3API.network,
                walletAddressPub
            );

            try {
                const getRewards = (await contract.stakedReward(walletAddressPub)) as unknown as { decoded: bigint[] };
                const getStakedAmount = (await contract.stakedAmount(walletAddressPub)) as unknown as {
                    decoded: bigint[];
                };

                setStakeReward(getRewards.decoded[0]);
                setStakedAmount(getStakedAmount.decoded[0]);
            } catch (e) {
                tools.toastError('Error in getting Stake Rewards');
                return;
            }

            try {
                const rewardPool = (await contract.rewardPool()) as unknown as { decoded: bigint[] };
                const totalStaked = (await contract.totalStaked()) as unknown as { decoded: bigint[] };
                //const timeStaked = (await contract.unstake()) as unknown as { decoded: any };

                setRewardPool(rewardPool.decoded[0]);
                setTotalStaked(totalStaked.decoded[0]);
            } catch (e) {
                tools.toastError('Can not get reward pool or total staked');
                return;
            }
        };
        void setWallet();

        const balance = bigIntToDecimal(OpNetBalance.amount, OpNetBalance.divisibility);
        setAvailableBalance(balance.toString());

        tools.showLoading(false);
    }, []);

    const [feeRate, setFeeRate] = useState(5);
    const [enableRBF, setEnableRBF] = useState(false);
    const keyring = useCurrentKeyring();
    const items = useMemo(() => {
        const _items: ItemData[] = keyring.accounts.map((v) => {
            return {
                key: v.address,
                account: v
            };
        });
        return _items;
    }, []);

    useEffect(() => {
        setError('');
        setDisabled(true);

        if (!inputAmount) {
            return;
        }

        if (inputAmount != '') {
            //Prevent repeated triggering caused by setAmount
            setDisabled(false);
            return;
        }
    }, [inputAmount, feeRate, enableRBF]);
    return (
        <Layout>
            <Header
                onBack={() => {
                    window.history.go(-1);
                }}
                title={'Your Stake'}
            />
            <Content style={$style}>
                <Row itemsCenter fullX justifyBetween>
                    <Text text={'Address'} color="textDim" size="md" />
                    <Text text={addressShortner(account.address)} size="md" />
                </Row>
                <Row itemsCenter fullX justifyBetween>
                    <Text text={'Balance'} size="md" color="textDim" />
                    <Text text={bigIntToDecimal(OpNetBalance.amount, OpNetBalance.divisibility).toString()} size="md" />
                </Row>
                <Row itemsCenter fullX justifyBetween>
                    <Text text={'Active Stake'} color="textDim" size="md" />
                    <Text text={bigIntToDecimal(stakedAmount, OpNetBalance.divisibility).toString()} size="md" />
                </Row>
                <Row itemsCenter fullX justifyBetween>
                    <Text text={'Reward'} color="textDim" size="md" />
                    <Text text={bigIntToDecimal(stakedReward, OpNetBalance.divisibility).toString()} size="md" />
                </Row>
                <Row itemsCenter fullX justifyBetween>
                    <Text text={'Total Staked'} color="textDim" size="md" />
                    <Text text={bigIntToDecimal(totalStaked, OpNetBalance.divisibility).toString()} size="md" />
                </Row>
                <Row itemsCenter fullX justifyBetween>
                    <Text text={'Reward Pool'} color="textDim" size="md" />
                    <Text text={bigIntToDecimal(rewardPool, OpNetBalance.divisibility).toString()} size="md" />
                </Row>
                <Row full>
                    <Button
                        preset="default"
                        style={{ height: '42px' }}
                        text="Claim"
                        full
                        onClick={() => {
                            navigate(RouteTypes.TxOpnetConfirmScreen, {
                                rawTxInfo: {
                                    items: items,
                                    account: account,
                                    inputAmount: new BigNumber(
                                        bigIntToDecimal(stakedReward, OpNetBalance.divisibility)
                                    ).toNumber(), // replace with actual inputAmount
                                    address: Web3API.WBTC, // replace with actual address
                                    feeRate: feeRate, // replace with actual feeRate
                                    priorityFee: BigInt(OpnetRateInputVal), // replace with actual OpnetRateInputVal
                                    header: 'Stake WBTC', // replace with actual header
                                    networkFee: feeRate, // replace with actual networkFee
                                    features: {
                                        rbf: false // replace with actual rbf value
                                    },
                                    inputInfos: [], // replace with actual inputInfos
                                    isToSign: false, // replace with actual isToSign value
                                    opneTokens: [
                                        {
                                            amount: Number(stakedReward),
                                            divisibility: OpNetBalance.divisibility,
                                            spacedRune: OpNetBalance.name,
                                            symbol: OpNetBalance.symbol
                                        }
                                    ],
                                    action: 'claim' // replace with actual opneTokens
                                }
                            });
                        }}
                    />

                    <Button
                        disabled={false}
                        style={{ height: '42px' }}
                        preset="primary"
                        text="Unstake"
                        onClick={() => {
                            navigate(RouteTypes.TxOpnetConfirmScreen, {
                                rawTxInfo: {
                                    items: items,
                                    account: account,
                                    inputAmount: new BigNumber(
                                        bigIntToDecimal(stakedAmount, OpNetBalance.divisibility)
                                    ).toNumber(), // replace with actual inputAmount
                                    address: Web3API.WBTC, // replace with actual address
                                    feeRate: feeRate, // replace with actual feeRate
                                    priorityFee: BigInt(OpnetRateInputVal), // replace with actual OpnetRateInputVal
                                    header: 'Stake WBTC', // replace with actual header
                                    networkFee: feeRate, // replace with actual networkFee
                                    features: {
                                        rbf: false // replace with actual rbf value
                                    },
                                    inputInfos: [], // replace with actual inputInfos
                                    isToSign: false, // replace with actual isToSign value
                                    opneTokens: [
                                        {
                                            amount: Number(stakedAmount),
                                            divisibility: OpNetBalance.divisibility,
                                            spacedRune: OpNetBalance.name,
                                            symbol: OpNetBalance.symbol
                                        }
                                    ],
                                    action: 'unstake' // replace with actual opneTokens
                                }
                            });
                        }}
                        full></Button>
                </Row>
            </Content>
        </Layout>
    );
}
