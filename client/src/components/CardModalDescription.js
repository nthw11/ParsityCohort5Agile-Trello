import { useSelector } from "react-redux";
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useForm } from "react-hook-form";
import { editCardModalDescription } from "../actions/EditCardModalDescirption";

const CardModalDescription = () => {
  const [isShow, setIsShow] = React.useState(true);
  const currentCard = useSelector(
    (state) => state.rootReducer.currentCard || null
  );
  const currentUser = useSelector(
    (state) => state.rootReducer.user.currentUser.username
  );
  console.log(currentUser);
  console.log("cardModalDescription", currentCard);
  const dispatch = useDispatch();
  const { reset, register, handleSubmit } = useForm();
  const cardDetails = currentCard.cardDescription || "Details";
  const handleClick = () => {
    setIsShow(!isShow);
  };

  const onSubmit = (data) => {
    dispatch(editCardModalDescription(data, currentUser));
    reset();
    setIsShow(!isShow);
  };

  return (
    <>
      <div>
        {isShow ? (
          <button id="activityShow" onClick={handleClick}>
            {cardDetails}
          </button>
        ) : (
          <div>
            <div className="mb-3">
              <form onSubmit={handleSubmit(onSubmit)}>
                <textarea
                  className="form-control"
                  rows="3"
                  {...register("cardDescription")}
                  defaultValue={currentCard.cardDescription}
                ></textarea>
                <button type="submit" className="btn btn-primary">
                  Update Description
                </button>
                <button>
                  <i
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CardModalDescription;
