import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  DndContext,
  getFirstCollision,
  KeyboardSensor,
  useSensors,
  useSensor,
  PointerSensor,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';

import { fetchBoard } from "../actions/BoardFetch";
import AddListBtn from "./AddListBtn";
// import List from "./List";
import { SortableList } from './SortableList';

const BoardView = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  let { boardId } = useParams();
  const token = localStorage.token;
  const name = useSelector((state) => state.rootReducer.currentBoard.boardName);
  const items = useSelector((state) => state.rootReducer.currentBoard.lists);
  const containers = useSelector(({rootReducer}) => rootReducer.normalizedLists.order)
  const lists = useSelector(({rootReducer}) => rootReducer.normalizedLists.normalized)
  // const [lists, setLists] = useState(items);
  // const [containers, setContainers] = useState(Object.keys(lists));
  const [activeId, setActiveId] = useState(null);
  const isSortingContainer = activeId ? containers.includes(activeId) : false;
  const lastOverId = useRef(null);
  const recentlyMovedToNewContainer = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    dispatch(fetchBoard(boardId, token)).then((res) => {
      if (!res) {
        console.log("no such board!");
        navigate("/b");
      }
    });
  }, []);

  const collisionDetectionStrategy = useCallback(
    (args) => {
      if (activeId && activeId in lists) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (container) => container.id in lists
          ),
        });
      }

      // Start by finding any intersecting droppable
      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0
          ? // If there are droppables intersecting with the pointer, return those
            pointerIntersections
          : rectIntersection(args);
      let overId = getFirstCollision(intersections, 'id');

      if (overId != null) {
        if (overId in lists) {
          const containerItems = lists[overId];

          // If a container is matched and it contains items (columns 'A', 'B', 'C')
          if (containerItems.length > 0) {
            // Return the closest droppable within that container
            overId = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (container) =>
                  container.id !== overId &&
                  containerItems.includes(container.id)
              ),
            })[0]?.id;
          }
        }

        lastOverId.current = overId;

        return [{ id: overId }];
      }

      // When a draggable item moves to a new container, the layout may shift
      // and the `overId` may become `null`. We manually set the cached `lastOverId`
      // to the id of the draggable item that was moved to the new container, otherwise
      // the previous `overId` will be returned which can cause items to incorrectly shift positions
      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = activeId;
      }

      // If no droppable is matched, return the last match
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [activeId, lists]
  );

  const [clonedItems, setClonedItems] = useState(null);

  const findContainer = (id) => {
    if (id in lists) {
      return id;
    }

    return Object.keys(lists).find((key) => lists[key].includes(id));
  };

  const getIndex = (id) => {
    const container = findContainer(id);

    if (!container) {
      return -1;
    }

    const index = lists[container].indexOf(id);

    return index;
  };

  const onDragCancel = () => {
    if (clonedItems) {
      // Reset items to their original state in case items have been
      // Dragged across containers
      dispatch({
        type: 'RESET_LIST',
        payload: clonedItems
      })
    }

    setActiveId(null);
    setClonedItems(null);
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, [lists]);

  return (
    <DndContext
    sensors={sensors}
    collisionDetection={collisionDetectionStrategy}
    measuring={{
      droppable: {
        strategy: MeasuringStrategy.Always,
      },
    }}
    onDragStart={({ active }) => {
      setActiveId(active.id);
      setClonedItems(lists);
    }}
    onDragOver={({ active, over }) => {
      const overId = over?.id;

      // Note: when moving lists we just return here and do not do anything
      if (overId == null || active.id in lists) {
        return;
      }

      const overContainer = findContainer(overId);
      const activeContainer = findContainer(active.id);

      if (!overContainer || !activeContainer) {
        return;
      }

      if (activeContainer !== overContainer) {
        
          const activeItems = lists[activeContainer];
          const overItems = lists[overContainer];
          const overIndex = overItems.indexOf(overId);
          const activeIndex = activeItems.indexOf(active.id);

          let newIndex;

          if (overId in lists) {
            newIndex = overItems.length + 1;
          } else {
            const isBelowOverItem =
              over &&
              active.rect.current.translated &&
              active.rect.current.translated.top >
                over.rect.top + over.rect.height;

            const modifier = isBelowOverItem ? 1 : 0;

            newIndex =
              overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
          }

          recentlyMovedToNewContainer.current = true;

          const updatedLists = {
            ...lists,
            [activeContainer]: lists[activeContainer].filter(
              (item) => item !== active.id
            ),
            [overContainer]: [
              ...lists[overContainer].slice(0, newIndex),
              lists[activeContainer][activeIndex],
              ...lists[overContainer].slice(
                newIndex,
                lists[overContainer].length
              ),
            ],
          };
          dispatch({type: "MOVE_CARD", payload: updatedLists})
      }
    }}
    onDragEnd={({ active, over }) => {
      // If id is in items we are moving a CONTAINER
      if (active.id in lists && over?.id) {
          const activeIndex = containers.indexOf(active.id);
          const overIndex = containers.indexOf(over.id);
          const newOrder = arrayMove(containers, activeIndex, overIndex);
          dispatch({type: "MOVE_LIST", payload: newOrder}) 

      }

      const activeContainer = findContainer(active.id);

      if (!activeContainer) {
        setActiveId(null);
        return;
      }

      const overId = over?.id;

      if (overId == null) {
        setActiveId(null);
        return;
      }

      const overContainer = findContainer(overId);

      if (overContainer) {
        const activeIndex = lists[activeContainer].indexOf(active.id);
        const overIndex = lists[overContainer].indexOf(overId);

        if (activeIndex !== overIndex) {
          const updatedLists = {
            ...currentLists,
            [overContainer]: arrayMove(
              currentLists[overContainer],
              activeIndex,
              overIndex
            ),
          }
          dispatch({type: "MOVE_LIST", payload: updatedLists})
        }
      }

      setActiveId(null);
    }}
  >
    <div className="container-fluid">
      <div className="row">
        <h3>{name}</h3>
      </div>

      <div className="row d-flex flex-nowrap">
      <SortableContext
        items={containers}
        strategy={horizontalListSortingStrategy}
      >
        {items.map((list) => (
          <SortableList
            key={list._id}
            cards={list.cards}
            name={list.listName}
            listId={list._id}
            boardId={boardId}
          />
        ))}
        </SortableContext>
        <AddListBtn boardId={boardId} />
      </div>
    </div>
  </DndContext>
  );
};

export default BoardView;
