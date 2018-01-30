// @flow

import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';

import type { ScriptVersion4Type } from '../../../../lib/index';
import render from '../utils/render';

const CenterHeading = styled.h1`
  text-align: center;
`;

const HeaderApp = <CenterHeading>Simple React Example</CenterHeading>;

class HeaderScript implements ScriptVersion4Type {
  version = 4;

  hydrate = async (container: Element) => render(HeaderApp, container);

  mount = async (container: Element) => render(HeaderApp, container);

  onStateChange = async () => {};

  onUpdateStatus = async () => {};

  unmount = async (container: Element) => { ReactDOM.unmountComponentAtNode(container); };
}

export default new HeaderScript();
