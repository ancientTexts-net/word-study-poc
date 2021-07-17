import { Dialog } from '@material-ui/core';
import BibleReference, {useBibleReference} from 'bible-reference-rcl';
import { AlignmentProvider } from 'alignment-editor-rcl';
import AlignmentEditor from './components/AlignmentEditor';
import useEffect from 'use-deep-compare-effect';

function App() {
  const {state, state: {bookId, chapter, verse}, actions} = useBibleReference({
    initialBook: 'TIT',
    initialChapter: 1,
    initialVerse: 1,
    onChange: () => {},
  });

  const reference = {bookId: bookId.toUpperCase(), chapter, verse};

  useEffect(() => {
    const supportedBibles = ['tit'];
    actions.applyBooksFilter(supportedBibles);
  }, [actions]);

  return (
    <div className="App">
      <header className="App-header">
      </header>
      <Dialog fullWidth={true} maxWidth={'xl'} open={true}>
        <div style={{margin: '12pt'}}>
          <AlignmentProvider>
            <AlignmentEditor reference={reference} />
          </AlignmentProvider>
        </div>
      </Dialog>
    </div>
  );
};

export default App;
