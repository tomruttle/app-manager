// @flow

import React, { PureComponent } from 'react';
import styled from 'styled-components';

type SwitcherButtonProps = {
  appName: string,
  appPath: string,
}

const Button = styled.button`
  border: 0;
  padding: 1em;
  box-shadow: 1px 1px #ddd;
  font-weight: bold;
  font-size: 0.8em;
`;

const RightAlignDiv = styled.div`
  text-align: right;
`;

const TextDiv = styled.div`
  color: ${({ colour }) => colour || 'Maroon'};
`;

class SwitcherButton extends PureComponent<SwitcherButtonProps> {
  handleClick = () => {
    window.history.pushState({}, this.props.appName, this.props.appPath);
  };

  render = () => (
    <RightAlignDiv>
      <Button onClick={this.handleClick}>Go to {this.props.appName}</Button>
    </RightAlignDiv>
  );
}

type SecondAppProps = {
  colour: ?string,
};

export default function SecondApp({ colour }: SecondAppProps) {
  return (
    <div>
      <h3>Second App</h3>

      <TextDiv colour={colour}>
        <blockquote><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus magna. Cras in mi at felis aliquet congue. Ut a est eget ligula molestie gravida. Curabitur massa. Donec eleifend, libero at sagittis mollis, tellus est malesuada tellus, at luctus turpis elit sit amet quam. Vivamus pretium ornare est.</p></blockquote>

        <ul>
          <li>Lorem ipsum dolor sit amet, consectetuer adipiscing elit.</li>
          <li>Aliquam tincidunt mauris eu risus.</li>
        </ul>

        <ol>
          <li>Lorem ipsum dolor sit amet, consectetuer adipiscing elit.</li>
          <li>Aliquam tincidunt mauris eu risus.</li>
        </ol>

        <p><strong>Pellentesque habitant morbi tristique</strong> senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante. Donec eu libero sit amet quam egestas semper. <em>Aenean ultricies mi vitae est.</em> Mauris placerat eleifend leo. Quisque sit amet est et sapien ullamcorper pharetra. Vestibulum erat wisi, condimentum sed, <code>commodo vitae</code>, ornare sit amet, wisi. Aenean fermentum, elit eget tincidunt condimentum, eros ipsum rutrum orci, sagittis tempus lacus enim ac dui. Donec non enim in turpis pulvinar facilisis. Ut felis.</p>
      </TextDiv>

      <SwitcherButton appName="First App" appPath="/first-app" />
    </div>
  );
}
